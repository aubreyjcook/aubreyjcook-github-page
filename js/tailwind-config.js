tailwind.config = {
  theme: {
    extend: {
      fontFamily: {
        /* everything is a terminal face — no proportional fallback on purpose.
           Consolas sits ahead of the generic keywords because it carries the
           box-drawing / geometric glyphs the terminal chrome uses. */
        sans: [
          'IBM Plex Mono',
          'ui-monospace',
          'Cascadia Code',
          'Source Code Pro',
          'Consolas',
          'Menlo',
          'DejaVu Sans Mono',
          'monospace',
        ],
        mono: [
          'IBM Plex Mono',
          'ui-monospace',
          'Cascadia Code',
          'Source Code Pro',
          'Consolas',
          'Menlo',
          'DejaVu Sans Mono',
          'monospace',
        ],
        display: ['VT323', 'IBM Plex Mono', 'ui-monospace', 'Consolas', 'Menlo', 'monospace'],
      },
    },
  },
};
