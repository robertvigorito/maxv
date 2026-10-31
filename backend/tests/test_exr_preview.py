"""EXR files are rendered to a browser-viewable JPEG for the viewer/timeline."""

from pathlib import Path

from PIL import Image

from backend.app.services.thumbnails import ThumbnailGenerator

FIXTURES = Path(__file__).parent / "fixtures" / "exr"


def test_exr_preview_is_viewable_jpeg(tmp_path):
    source = FIXTURES / "still.exr"
    preview = tmp_path / "preview.jpg"

    assert ThumbnailGenerator().generate_exr_preview(source, preview)

    with Image.open(preview) as img:
        assert img.format == "JPEG"
        assert img.mode == "RGB"
        assert img.size[0] > 0 and img.size[1] > 0


def test_exr_preview_for_sequence_frames(tmp_path):
    generator = ThumbnailGenerator()
    for frame in sorted(FIXTURES.glob("beauty.*.exr")):
        assert generator.generate_exr_preview(frame, tmp_path / f"{frame.stem}.jpg")
