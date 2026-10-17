import os
import tempfile

# Isolate tests from real data and from any API key in .env. Must run before `config` is imported.
_tmp = tempfile.mkdtemp(prefix="beeable-test-")
os.environ["STORE_PATH"] = os.path.join(_tmp, "store.json")
os.environ["UPLOAD_DIR"] = os.path.join(_tmp, "uploads")
os.environ["INTAKE_PROVIDER"] = "none"
