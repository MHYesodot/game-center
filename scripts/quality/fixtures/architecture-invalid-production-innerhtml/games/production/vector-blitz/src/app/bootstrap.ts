const app = document.querySelector('#app')

if (!app) {
  throw new Error('missing app')
}

app.innerHTML = `
  <main class="game-shell">
    <section>
      <h1>Big production HUD</h1>
      <p>This should not be directly injected for a production game client.</p>
      <div class="hud-grid">
        <div>Health</div>
        <div>100</div>
        <div>Speed</div>
        <div>4.2x</div>
        <div>Radar</div>
        <div>Enabled</div>
        <div>Squad</div>
        <div>Connected</div>
        <div>Loadout</div>
        <div>Ready</div>
        <div>Telemetry</div>
        <div>Nominal</div>
      </div>
    </section>
  </main>
`