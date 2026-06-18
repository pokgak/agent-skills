.PHONY: test-skill-pressure test-scenarios test-scenarios-core test

test-skill-pressure:
	uv run --group test python tests/skill-pressure/run.py $(ARGS)

test-scenarios:
	uv run --group test pytest tests/scenarios/ -v $(ARGS)

test-scenarios-core:
	uv run --group test pytest tests/scenarios/ -v -m core $(ARGS)

test: test-skill-pressure test-scenarios-core
