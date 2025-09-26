.PHONY: run job check

run:
	uvicorn main:app --host 0.0.0.0 --port 8000

job:
	python -c "from main import run_job; run_job()"

check:
	python -m compileall .
