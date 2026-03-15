let mermaidInstance: typeof import('mermaid').default | null = null;
let initialized = false;
let currentTheme: 'dark' | 'light' | null = null;

function getMermaidTheme(theme: 'dark' | 'light'): 'dark' | 'default' {
  return theme === 'dark' ? 'dark' : 'default';
}

/**
 * Initialize mermaid with the given theme. Safe to call multiple times —
 * re-initializes if theme has changed, no-op otherwise.
 * Dynamically imports the mermaid library on first call.
 *
 * @param theme - 'dark' or 'light' (maps to mermaid's 'dark' / 'default' themes)
 */
async function initMermaid(theme: 'dark' | 'light'): Promise<void> {
  if (initialized && currentTheme === theme) {
    return;
  }

  const { default: mermaid } = await import('mermaid');
  mermaidInstance = mermaid;

  mermaid.initialize({
    startOnLoad: false,
    theme: getMermaidTheme(theme),
  });

  initialized = true;
  currentTheme = theme;
}

/**
 * Render a mermaid diagram and return the SVG markup.
 *
 * @param id - Unique element ID for the render container
 * @param code - Raw mermaid source code
 * @returns SVG markup string
 * @throws If mermaid fails to parse or render the diagram
 */
async function renderDiagram(id: string, code: string): Promise<string> {
  if (mermaidInstance === null) {
    throw new Error('Mermaid not initialized. Call initMermaid() first.');
  }

  const { svg } = await mermaidInstance.render(id, code);
  return svg;
}

/**
 * Update the mermaid theme. Call when the user toggles dark/light.
 * Subsequent renderDiagram calls will use the new theme.
 *
 * @param theme - 'dark' or 'light'
 */
async function updateTheme(theme: 'dark' | 'light'): Promise<void> {
  if (currentTheme === theme) {
    return;
  }

  initialized = false;
  await initMermaid(theme);
}

export { initMermaid, renderDiagram, updateTheme };
