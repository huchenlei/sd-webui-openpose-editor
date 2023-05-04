import gradio as gr
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from jinja2 import FileSystemLoader

import modules.scripts as scripts
import modules.script_callbacks as script_callbacks

VERSION = '0.0.1'
EXTENSION_DIR = 'extensions/sd-webui-openpose-editor'
TEMPLATES_DIR = f'{EXTENSION_DIR}/templates'
import os

custom_templates_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'custom_templates')

def mount_openpose_api(_: gr.Blocks, app: FastAPI):
    templates = Jinja2Templates(directory=TEMPLATES_DIR)
    # Configure the Jinja2 template loader to search for templates in both folders
    app.jinja_loader = FileSystemLoader([custom_templates_path])    

    @app.get("/openpose_editor/greeting", response_class=HTMLResponse)
    async def display_greeting(request: Request):
        print('pose:', os.getcwd())
        return templates.TemplateResponse('greetings.html', {"request": request, 'name': "Charlie"})
    
    @app.post('/openpose_editor')
    async def index():
        pass

script_callbacks.on_app_started(mount_openpose_api)

