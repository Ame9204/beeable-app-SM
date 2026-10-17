"""Photo processing: fix orientation, resize, strip EXIF. Deterministic, so the demo photo hash is stable."""

import io

from PIL import Image, ImageOps

from config import UPLOAD_MAX_PX


def process_image(data: bytes, max_px: int = UPLOAD_MAX_PX) -> tuple[bytes, tuple[int, int]]:
    """Return (jpeg_bytes, (width, height)). Raises PIL.UnidentifiedImageError for non-images.

    All EXIF (incl. GPS) is dropped: the report's location travels separately as lat/lng.
    """
    with Image.open(io.BytesIO(data)) as img:
        img = ImageOps.exif_transpose(img)  # apply camera rotation before EXIF is discarded
        img = img.convert("RGB")
        img.thumbnail((max_px, max_px))
        out = io.BytesIO()
        img.save(out, format="JPEG", quality=85)  # no exif= argument → no metadata written
        return out.getvalue(), img.size
