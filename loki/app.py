"""Create and run the webview window."""

import os

import webview

from . import APP_TITLE, paths
from .api import Api
from .settings import SettingsManager


def run(debug: bool = False) -> None:
    # Allow notification sound without a user gesture (WebView2).
    os.environ.setdefault(
        "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
        "--autoplay-policy=no-user-gesture-required",
    )

    settings = SettingsManager()
    api = Api(settings)

    # Default size doubles as the minimum (can't shrink below it).
    default_size = (980, 900)
    window = webview.create_window(
        title=APP_TITLE,
        url=paths.resource("web", "index.html"),
        js_api=api,
        width=default_size[0],
        height=default_size[1],
        min_size=default_size,
        background_color="#0e1216",
        text_select=False,
    )
    api.bind(window)

    # WinForms backend needs an .ico icon
    webview.start(debug=debug, icon=paths.resource("assets", "icon.ico"))
