@echo off
REM Start a local HTTP server on port 8000 and open the examples index
REM This batch file is intended for local use only and should not be versioned.
REM It assumes that Python is installed and available on your PATH.

echo Starting local server at http://localhost:8000 ...
start "" http://localhost:8000/index.html
python -m http.server 8000