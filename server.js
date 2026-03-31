import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { chromium } from 'playwright';

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize the MCP Server
const server = new Server(
  { name: 'screenshot-mcp-server', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// Define the tool
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: 'take_screenshot',
    description: 'Captures a screenshot of a webpage and returns it as an image for AI visual analysis. Great for reading live webcams.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to screenshot' },
        delay_ms: { type: 'number', description: 'Milliseconds to wait after load (default: 2000)' }
      },
      required: ['url']
    }
  }]
}));

// Implement the screenshot logic
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== 'take_screenshot') throw new Error('Unknown tool');

  const { url, delay_ms = 2000 } = request.params.arguments;
  let browser;

  try {
    console.log(`Taking screenshot of: ${url}`);
    browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    if (delay_ms > 0) await page.waitForTimeout(delay_ms);

    const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 80 });
    
    // Return the image directly to the AI's context!
    return {
      content: [{
        type: 'image',
        data: screenshotBuffer.toString('base64'),
        mimeType: 'image/jpeg'
      }]
    };
  } catch (error) {
    console.error('Error:', error);
    return { content: [{ type: 'text', text: `Failed: ${error.message}` }], isError: true };
  } finally {
    if (browser) await browser.close();
  }
});

// Setup SSE Transport for Toolbelt
let transport;

app.get('/mcp', async (req, res) => {
  transport = new SSEServerTransport('/message', res);
  await server.connect(transport);
  console.log('Toolbelt connected via SSE!');
});

app.post('/message', async (req, res) => {
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(503).send('No active MCP connection');
  }
});

app.listen(PORT, () => {
  console.log(`Screenshot MCP Server running on port ${PORT}`);
  console.log(`Toolbelt Connection URL: http://localhost:${PORT}/mcp`);
});