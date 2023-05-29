def preload(parser):
    parser.add_argument(
        "--disable-openpose-editor-auto-update",
        action='store_true',
        help="Disable auto-update of openpose editor",
        default=None,
    )
