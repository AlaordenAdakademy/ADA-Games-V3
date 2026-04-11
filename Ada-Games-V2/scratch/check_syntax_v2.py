import sys

def check_syntax(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    stack = []
    line_num = 1
    col_num = 1
    
    in_string = False
    quote_char = ''
    in_comment = False
    in_multiline_comment = False
    
    i = 0
    while i < len(content):
        char = content[i]
        
        if char == '\n':
            line_num += 1
            col_num = 1
            if in_comment:
                in_comment = False
        else:
            col_num += 1
            
        if in_comment:
            i += 1
            continue
            
        if in_multiline_comment:
            if char == '*' and i + 1 < len(content) and content[i+1] == '/':
                in_multiline_comment = False
                i += 2
                continue
            i += 1
            continue
            
        if in_string:
            if char == quote_char and (content[i-1] != '\\' or (i > 1 and content[i-2] == '\\')):
                in_string = False
            i += 1
            continue
            
        if char == '/' and i + 1 < len(content):
            if content[i+1] == '/':
                in_comment = True
                i += 2
                continue
            elif content[i+1] == '*':
                in_multiline_comment = True
                i += 2
                continue
                
        if char in ('"', "'", '`'):
            in_string = True
            quote_char = char
            start_line, start_col = line_num, col_num
            i += 1
            continue
            
        if char in ('{', '[', '('):
            stack.append((char, line_num, col_num))
        elif char in ('}', ']', ')'):
            if not stack:
                print(f"Extra closing {char} at line {line_num}, col {col_num}")
                return
            
            last, l_num, c_num = stack.pop()
            if (char == '}' and last != '{') or \
               (char == ']' and last != '[') or \
               (char == ')' and last != '('):
                print(f"Mismatched {last} at line {l_num}, col {c_num} and {char} at line {line_num}, col {col_num}")
                return
        i += 1

    if in_string:
        print(f"Unclosed string starting with {quote_char} at line {start_line}, col {start_col}")

    if stack:
        for char, l_num, c_num in stack:
            print(f"Unclosed {char} at line {l_num}, col {c_num}")

if __name__ == "__main__":
    check_syntax(sys.argv[1])
