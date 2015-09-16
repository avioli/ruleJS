/* description: Parses end evaluates mathematical expressions. */
/* lexical grammar */
/* TODO: define grammar and handlers for cell and time */
%lex
%%
\s+									                                                            {/* skip whitespace */}
'"'("\\"["]|[^"])*'"'				                                                    {return 'STRING';}
"'"('\\'[']|[^'])*"'"				                                                    {return 'STRING';}
[A-Za-z]{1,}[A-Za-z_0-9]+(?=[(])                                                {return 'FUNCTION';}
([0]?[1-9]|1[0-2])[:][0-5][0-9]([:][0-5][0-9])?[ ]?(AM|am|aM|Am|PM|pm|pM|Pm)		{return 'TIME_AMPM';}
([0]?[0-9]|1[0-9]|2[0-3])[:][0-5][0-9]([:][0-5][0-9])?        									{return 'TIME_24';}
'$'[A-Za-z]+'$'[0-9]+                                                           {return 'FIXEDCELL';}
'$'[A-Za-z]+[0-9]+                                                              {return 'FIXEDCELL';}
[A-Za-z]+'$'[0-9]+                                                              {return 'FIXEDCELL';}
[A-Za-z]+[0-9]+                                                                 {return 'CELL';}
[A-Za-z]+(?=[(])    				                                                    {return 'FUNCTION';}
[A-Za-z]{1,}[A-Za-z_0-9]+			                                                  {return 'VARIABLE';}
[A-Za-z_]+           				                                                    {return 'VARIABLE';}
[0-9]+          			  		                                                    {return 'NUMBER';}
'['(.*)?']'                                                                     {return 'ARRAY';}
"$"									                                                            {/* skip whitespace */}
"&"                                                                             {return '&';}
" "									                                                            {return ' ';}
[.]									                                                            {return 'DECIMAL';}
":"									                                                            {return ':';}
";"									                                                            {return ';';}
","									                                                            {return ',';}
"*" 								                                                            {return '*';}
"/" 								                                                            {return '/';}
"-" 								                                                            {return '-';}
"+" 								                                                            {return '+';}
"^" 								                                                            {return '^';}
"(" 								                                                            {return '(';}
")" 								                                                            {return ')';}
">" 								                                                            {return '>';}
"<" 								                                                            {return '<';}
"NOT"								                                                            {return 'NOT';}
'"'									                                                            {return '"';}
"'"									                                                            {return "'";}
"!"									                                                            {return "!";}
"="									                                                            {return '=';}
"%"									                                                            {return '%';}
[#]									                                                            {return '#';}
<<EOF>>								                                                          {return 'EOF';}
/lex

/* operator associations and precedence (low-top, high- bottom) */
%left '='
%left '<=' '>=' '<>' 'NOT' '||'
%left '>' '<'
%left '+' '-'
%left '*' '/'
%left '^'
%left '&'
%left '%'
%left UMINUS

%start expressions

%% /* language grammar */

expressions
    : expression EOF {
        return $1;
    }
;

expression
    : variableSequence {
        $$ = yy.handler.callVariable.call(this, $1);
      }
    | TIME_AMPM {
        $$ = yy.handler.time.call(yy.obj, $1, true);
      }
    | TIME_24 {
        $$ = yy.handler.time.call(yy.obj, $1);
      }
    | number {
        $$ = yy.handler.number($1);
      }
    | STRING {
        $$ = yy.handler.string($1);
      }
    | expression '&' expression {
        $$ = yy.handler.specialMatch('&', $1, $3);
      }
    | expression '=' expression {
        $$ = yy.handler.logicMatch('=', $1, $3);
      }
    | expression '+' expression {
        $$ = yy.handler.mathMatch('+', $1, $3);
      }
    | '(' expression ')' {
        $$ = yy.handler.number($2);
      }
    | expression '<' '=' expression {
        $$ = yy.handler.logicMatch('<=', $1, $4);
      }
    | expression '>' '=' expression {
        $$ = yy.handler.logicMatch('>=', $1, $4);
      }
	  | expression '<' '>' expression {
	      $$ = yy.handler.logicMatch('<>', $1, $4);
      }
    | expression NOT expression {
        $$ = yy.handler.logicMatch('NOT', $1, $3);
      }
    | expression '>' expression {
        $$ = yy.handler.logicMatch('>', $1, $3);
      }
    | expression '<' expression {
        $$ = yy.handler.logicMatch('<', $1, $3);
      }
    | expression '-' expression {
        $$ = yy.handler.mathMatch('-', $1, $3);
      }
    | expression '*' expression {
        $$ = yy.handler.mathMatch('*', $1, $3);
      }
    | expression '/' expression {
        $$ = yy.handler.mathMatch('/', $1, $3);
      }
    | expression '^' expression {
        $$ = yy.handler.mathMatch('^', $1, $3);
      }
    | '-' expression {
        var n1 = yy.handler.numberInverted($2);
        $$ = n1;
        if (isNaN($$)) {
            $$ = 0;
        }
      }
    | '+' expression {
        var n1 = yy.handler.number($2);
        $$ = n1;
        if (isNaN($$)) {
            $$ = 0;
        }
      }
    | FUNCTION '(' ')' {
        $$ = yy.handler.callFunction.call(this, $1, '');
      }
    | FUNCTION '(' expseq ')' {
        $$ = yy.handler.callFunction.call(this, $1, $3);
      }
    | cell
    | error
    | error error
;

cell
   : FIXEDCELL {
      $$ = yy.handler.fixedCellValue.call(yy.obj, $1);
    }
  | FIXEDCELL ':' FIXEDCELL {
      $$ = yy.handler.fixedCellRangeValue.call(yy.obj, $1, $3);
    }
  | CELL {
      $$ = yy.handler.cellValue.call(yy.obj, $1);
    }
  | CELL ':' CELL {
      $$ = yy.handler.cellRangeValue.call(yy.obj, $1, $3);
    }
;

expseq
  : expression {
      // if (yy.handler.isArray($1)) {
      //   $$ = $1;
      // } else {
        $$ = [$1];
      // }
    }
  | ARRAY {
      console && console.warning && console.warn('EVAL');
      var result = [],
          arr = eval("[" + yytext + "]");

      arr.forEach(function (item) {
        result.push(item);
      });

      $$ = result;
    }
	| expseq ';' expression {
      $1.push($3);
      $$ = $1;
    }
 	| expseq ',' expression {
      $1.push($3);
      $$ = $1;
    }
;

variableSequence
	: VARIABLE {
      $$ = [$1];
    }
	| variableSequence DECIMAL VARIABLE {
      $$ = (yy.handler.isArray($1) ? $1 : [$1]);
      $$.push($3);
    }
;

number
  : NUMBER {
      $$ = $1;
    }
	| NUMBER DECIMAL NUMBER {
      $$ = ($1 + '.' + $3) * 1;
    }
	| number '%' {
      $$ = $1 * 0.01;
    }
;

error
  : '#' VARIABLE '!' {
      $$ = $1 + $2 + $3;
    }
  | VARIABLE '#' VARIABLE '!' {
      $$ = $2 + $3 + $4;
    }
;

%%
