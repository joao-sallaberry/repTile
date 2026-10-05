// Copies assets/sounds/*.wav into android/app/src/main/res/raw so that
// notification channels can use the timer beeps as their sound.
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

module.exports = function withRawSounds(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const src = path.join(cfg.modRequest.projectRoot, 'assets', 'sounds');
      const dest = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'raw');
      fs.mkdirSync(dest, { recursive: true });
      for (const file of fs.readdirSync(src)) {
        if (file.endsWith('.wav')) fs.copyFileSync(path.join(src, file), path.join(dest, file));
      }
      return cfg;
    },
  ]);
};
