import sys

def check_brackets(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    stack = []
    line_num = 1
    col_num = 1
    
    in_string = False
    quote_char = ''
    in_comment = False
    in_multiline_comment = False
    
    for i, char in enumerate(content):
        if char == '\n':
            line_num += 1
            col_num = 1
            in_comment = False
        else:
            col_num += 1
            
        if in_comment:
            continue
            
        if in_multiline_comment:
            if char == '*' and i + 1 < len(content) and content[i+1] == '/':
                in_multiline_comment = False
                # Skip the next char
            continue
            
        if in_string:
            if char == quote_char and (content[i-1] != '\\' or content[i-2] == '\\'):
                in_string = False
            continue
            
        if char == '/' and i + 1 < len(content):
            if content[i+1] == '/':
                in_comment = True
                continue
            elif content[i+1] == '*':
                in_multiline_comment = True
                continue
                
        if char in ('"', "'", '`'):
            in_string = True
            quote_char = char
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

    if stack:
        for char, l_num, c_num in stack:
            print(f"Unclosed {char} at line {l_num}, col {c_num}")

if __name__ == "__main__":
    check_brackets(sys.argv[1])
