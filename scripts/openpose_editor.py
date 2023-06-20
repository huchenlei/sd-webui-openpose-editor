import os
import zipfile
import gradio as gr
import requests
import json
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from typing import Optional

import modules.script_callbacks as script_callbacks
from modules import shared, scripts


class Item(BaseModel):
    # image url.
    image_url: str
    # stringified pose JSON.
    pose: str


EXTENSION_DIR = scripts.basedir()
DIST_DIR = os.path.join(EXTENSION_DIR, 'dist')


def get_latest_release(owner, repo) -> Optional[str]:
    url = f"https://api.github.com/repos/{owner}/{repo}/releases/latest"
    response = requests.get(url)
    data = response.json()
    if response.status_code == 200:
        return data["tag_name"]
    else:
        return None


def get_current_release() -> Optional[str]:
    if not os.path.exists(DIST_DIR):
        return None

    with open(os.path.join(DIST_DIR, "version.txt"), "r") as f:
        return f.read()


def get_version_from_package_json():
    with open(os.path.join(EXTENSION_DIR, "package.json")) as f:
        data = json.load(f)
        return f"v{data.get('version', None)}"


def download_latest_release(owner, repo):
    url = f"https://api.github.com/repos/{owner}/{repo}/releases/latest"
    response = requests.get(url)
    data = response.json()

    if response.status_code == 200 and "assets" in data and len(data["assets"]) > 0:
        asset_url = data["assets"][0]["url"]  # Get the URL of the first asset
        headers = {"Accept": "application/octet-stream"}
        response = requests.get(asset_url, headers=headers, allow_redirects=True)

        if response.status_code == 200:
            filename = "dist.zip"
            with open(filename, "wb") as file:
                file.write(response.content)

            # Unzip the file
            with zipfile.ZipFile(filename, "r") as zip_ref:
                zip_ref.extractall(DIST_DIR)

            # Remove the zip file
            os.remove(filename)
        else:
            print(f"Failed to download the file {url}.")
    else:
        print(f"Could not get the latest release or there are no assets {url}.")


def need_update(current_version: Optional[str], package_version: str) -> bool:
    if current_version is None:
        return True
    
    def parse_version(version: str):
        return tuple(int(num) for num in version[1:].split('.'))
    
    return parse_version(current_version) < parse_version(package_version)


def update_app():
    """Attempts to update the application to latest version"""
    owner = "huchenlei"
    repo = "sd-webui-openpose-editor"

    package_version = get_version_from_package_json()
    current_version = get_current_release()

    assert package_version is not None
    if need_update(current_version, package_version):
        download_latest_release(owner, repo)


def mount_openpose_api(_: gr.Blocks, app: FastAPI):
    if not getattr(shared.cmd_opts, "disable_openpose_editor_auto_update", False):
        update_app()

    templates = Jinja2Templates(directory=DIST_DIR)
    app.mount(
        "/openpose_editor",
        StaticFiles(directory=DIST_DIR, html=True),
        name="openpose_editor",
    )

    @app.get("/openpose_editor_index", response_class=HTMLResponse)
    async def index_get(request: Request):
        return templates.TemplateResponse(
            "index.html", {"request": request, "data": {}}
        )

    @app.post("/openpose_editor_index", response_class=HTMLResponse)
    async def index_post(request: Request, item: Item):
        return templates.TemplateResponse(
            "index.html", {"request": request, "data": item.dict()}
        )


script_callbacks.on_app_started(mount_openpose_api)
