import gradio as gr
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from jinja2 import FileSystemLoader
from pydantic import BaseModel

import modules.scripts as scripts
import modules.script_callbacks as script_callbacks

class Item(BaseModel):
    # image url.
    image_url: str
    # stringified pose JSON.
    pose: str

EXTENSION_DIR = 'extensions/sd-webui-openpose-editor'
DIST_DIR = f'{EXTENSION_DIR}/dist'

def mount_openpose_api(_: gr.Blocks, app: FastAPI):
    templates = Jinja2Templates(directory=DIST_DIR)
    app.mount('/openpose_editor', StaticFiles(directory=DIST_DIR, html=True), name='openpose_editor')
    
    @app.get('/openpose_editor_index/', response_class=HTMLResponse)
    async def index_get(request: Request):
        return templates.TemplateResponse('index.html', {"request": request, "data": {}})
    
    @app.post('/openpose_editor_index/', response_class=HTMLResponse)
    async def index_post(request: Request, item: Item):
        return templates.TemplateResponse('index.html', {"request": request, "data": item.dict()})

        

script_callbacks.on_app_started(mount_openpose_api)

