#!/bin/bash
cd panthersearch-server && '/c/Users/Lab/AppData/Local/Programs/Python/Python312/python.exe' -m uvicorn app.main:app --host 0.0.0.0 --port 3001 &
cd ../panthersearch-client && '/c/Program Files/nodejs/npm.cmd' run dev -- --host 0.0.0.0 &
wait
