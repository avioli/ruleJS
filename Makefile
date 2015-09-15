webpack = node_modules/webpack/bin/webpack.js
jison = node_modules/jison/lib/cli.js

build:
	@$(webpack)
	@$(webpack) --standalone
	@$(webpack) --prod
	@$(webpack) --prod --standalone

parser:
	@$(jison) lib/parser/parser.jison -m amd -o lib/parser/parser.js

.PHONY: build parser
