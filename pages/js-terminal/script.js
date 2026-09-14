(function() {
  const terminal = document.getElementById('terminal');

  // Save original console methods
  const originalLog = console.log;
  const originalError = console.error;

  // Override console.log
  console.log = function(...args) {
    originalLog.apply(console, args);
    args.forEach(arg => {
      const div = document.createElement('div');
      div.textContent = arg;
      terminal.appendChild(div);
    });
  };

  // Override console.error
  console.error = function(...args) {
    originalError.apply(console, args);
    args.forEach(arg => {
      const div = document.createElement('div');
      div.style.color = 'red';
      div.textContent = arg;
      terminal.appendChild(div);
    });
  };

  // Test messages
  console.log("Sandbox initialized.");
  console.error("This is a sample error.");

  // Future: You can add functionality to evaluate user code here.
})();