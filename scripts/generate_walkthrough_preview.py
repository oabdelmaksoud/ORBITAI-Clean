import os

MARKDOWN_FILE = 'docs/WALKTHROUGH.md'
OUTPUT_FILE = 'docs/WALKTHROUGH_PREVIEW.html'

TEMPLATE_START = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OrbitAI Walkthrough Preview</title>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.0/dist/mermaid.min.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown.min.css">
    <style>
        body {
            box-sizing: border-box;
            min-width: 200px;
            max-width: 980px;
            margin: 0 auto;
            padding: 45px;
            font-family: -apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji";
            background-color: #0d1117;
            color: #c9d1d9;
        }
        @media (max-width: 767px) { body { padding: 15px; } }
        .markdown-body { box-sizing: border-box; background-color: #0d1117; color: #c9d1d9; }
        .markdown-body table tr { background-color: #0d1117; border-top-color: #21262d; }
        .markdown-body table tr:nth-child(2n) { background-color: #161b22; }
        .markdown-body table th, .markdown-body table td { border-color: #30363d; }
        .mermaid { background: white; padding: 20px; border-radius: 6px; display: flex; justify-content: center; margin: 20px 0; }
    </style>
</head>
<body class="markdown-body">
    <div id="content">Loading documentation...</div>
    <textarea id="markdown-data" style="display:none;">"""

TEMPLATE_END = """</textarea>
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            // 1. Initialize Mermaid
            mermaid.initialize({ startOnLoad: false, theme: 'default' });

            // 2. Parse Markdown (standard render)
            const markdownContent = document.getElementById('markdown-data').value;
            document.getElementById('content').innerHTML = marked.parse(markdownContent);

            // 3. Post-process: Find all mermaid code blocks and convert to div.mermaid
            // marked.js renders them as <pre><code class="language-mermaid">...</code></pre>
            const mermaidBlocks = document.querySelectorAll('code.language-mermaid');
            
            mermaidBlocks.forEach(block => {
                const graphDefinition = block.textContent;
                const preElement = block.parentElement; // The <pre> tag
                
                // Create replacement div
                const div = document.createElement('div');
                div.className = 'mermaid';
                div.textContent = graphDefinition;
                
                // Replace <pre> with <div class="mermaid">
                if (preElement.tagName === 'PRE') {
                    preElement.replaceWith(div);
                }
            });

            // 4. Run Mermaid
            mermaid.run({
                nodes: document.querySelectorAll('.mermaid')
            });
        });
    </script>
</body>
</html>"""

try:
    with open(MARKDOWN_FILE, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Escape closing script/textarea tags just in case
    content = content.replace("</textarea>", "&lt;/textarea&gt;")
    content = content.replace("</script>", "<\\/script>")

    final_html = TEMPLATE_START + "\n" + content + "\n" + TEMPLATE_END

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(final_html)
    
    print(f"Successfully regenerated {OUTPUT_FILE} with post-processing logic.")

except Exception as e:
    print(f"Error: {e}")
