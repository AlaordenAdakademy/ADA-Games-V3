import sys
import re

def find_redeclarations(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    declarations = {} # name -> (line, col)
    
    # Regex to find const/let/var/function declarations
    # This is simplified but should catch most top-level and component-level ones
    pattern = re.compile(r'\b(const|let|var|function)\s+([a-zA-Z0-9_$]+)\b')
    # Also catch destructuring: const [var, setVar] = ...
    destruct_pattern = re.compile(r'\b(const|let|var)\s+\[\s*([a-zA-Z0-9_$]+)\s*,\s*([a-zA-Z0-9_$]+)\s*\]')

    for i, line in enumerate(lines):
        line_content = line.strip()
        if line_content.startswith('//') or line_content.startswith('/*'):
            continue
            
        # Standard declarations
        for match in pattern.finditer(line):
            keyword = match.group(1)
            name = match.group(2)
            if name in declarations:
                prev_line, prev_kw = declarations[name]
                if keyword != 'var': # var can be redeclared
                     print(f"Potential redeclaration of '{name}' at line {i+1} (previously at line {prev_line})")
            else:
                declarations[name] = (i+1, keyword)

        # Destructuring
        for match in destruct_pattern.finditer(line):
            kw = match.group(1)
            v1 = match.group(2)
            v2 = match.group(3)
            for name in [v1, v2]:
                if name in declarations:
                    prev_line, prev_kw = declarations[name]
                    print(f"Potential redeclaration of '{name}' in destructuring at line {i+1} (previously at line {prev_line})")
                else:
                    declarations[name] = (i+1, kw)

if __name__ == "__main__":
    find_redeclarations(sys.argv[1])
