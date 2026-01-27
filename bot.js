cat > bot.js << 'EOF'
const ethers = require('ethers');
const axios = require('axios');
const fs = require('fs');

const config = require('./config.json');
const WALLET_FILE = './wallets.json';
const LOG_FILE = './bot.log';

// Helpers
const log = (...args) => {
  const msg = `[${new Date().toISOString()}] ${args.join(' ')}`;
  console.log(msg);
  fs.appendFileSync(LOG_FILE, msg + '\n');
};

const randomDelay = (min, max) => 
  new Promise(res => setTimeout(res, Math.floor(Math.random() * (max - min + 1)) + min));

const loadWallets = () => {
  if (fs.existsSync(WALLET_FILE)) {
    try { return JSON.parse(fs.readFileSync(WALLET_FILE, 'utf8')); } catch (e) { return []; }
  }
  return [];
};

const saveWallets = (wallets) => {
  fs.writeFileSync(WALLET_FILE, JSON.stringify(wallets, null, 2));
};

// API Functions
const syncUser = async (address) => {
  const res = await axios.post(
    `${config.baseUrl}${config.api.userSync}`,
    { address },
    { params: { ref: config.referralCode }, headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
  );
  return res.data;
};

const claimFaucet = async (address) => {
  try {
    await axios.post(
      `${config.baseUrl}${config.api.faucet}`,
      { address },
      { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
    );
    return true;
  } catch (e) { return false; }
};

// Main
(async () => {
  console.log('🚀 Bot Auto-Referral Zugchain Testnet');
  console.log(`🔗 Referral Code: ${config.referralCode}\n`);

  // Ambil jumlah dari argumen CLI
  const targetCount = process.argv[2] ? parseInt(process.argv[2]) : null;
  if (!targetCount || isNaN(targetCount) || targetCount <= 0) {
    console.log('❌ Usage: node bot.js <jumlah_wallet>');
    console.log('Contoh: node bot.js 100');
    return;
  }

  let wallets = loadWallets();
  log(`📊 Existing wallets: ${wallets.length}`);
  log(`🎯 Target baru: ${targetCount}\n`);

  let success = 0, duplicate = 0, failed = 0;

  for (let i = 0; i < targetCount; i++) {
    // Buat wallet baru
    const wallet = ethers.Wallet.createRandom();
    const addr = wallet.address;
    log(`[${i+1}/${targetCount}] ${addr}`);

    try {
      // Sync dengan referral
      await syncUser(addr);
      log(`  ✅ Sync berhasil → referral tercatat!`);

      // Claim faucet
      await claimFaucet(addr);
      log(`  💧 Faucet claimed`);

      wallets.push({
        index: wallets.length + 1,
        address: addr,
        privateKey: wallet.privateKey,
        createdAt: new Date().toISOString(),
        status: 'success'
      });
      success++;
    } catch (e) {
      const msg = e.response?.data?.message || e.message || String(e);
      if (msg.includes('already') || msg.includes('duplicate') || msg.includes('exists')) {
        log(`  ⚠️ Duplicate: ${msg.substring(0, 50)}`);
        duplicate++;
      } else {
        log(`  ❌ Gagal: ${msg.substring(0, 50)}`);
        failed++;
      }
      wallets.push({
        address: addr,
        privateKey: wallet.privateKey,
        createdAt: new Date().toISOString(),
        status: msg.includes('already') ? 'duplicate' : 'failed',
        error: msg
      });
    }

    // Simpan progres tiap 5 wallet
    if ((i + 1) % 5 === 0) {
      saveWallets(wallets);
      log(`💾 Progress saved (${i+1}/${targetCount})\n`);
    }

    // Delay antar akun
    if (i < targetCount - 1) {
      const delay = config.delays.betweenAccounts;
      await randomDelay(delay, delay + 2000);
    }
  }

  // Simpan final
  saveWallets(wallets);

  // Ringkasan
  console.log('\n' + '='.repeat(50));
  console.log('✅ SELESAI');
  console.log(`   Berhasil : ${success}`);
  console.log(`   Duplicate: ${duplicate}`);
  console.log(`   Gagal    : ${failed}`);
  console.log(`   Total    : ${wallets.length} wallet`);
  console.log('='.repeat(50));
  console.log(`\n📁 Private keys: ${WALLET_FILE}`);
  console.log(`📄 Log: ${LOG_FILE}`);
  console.log(`\n⚠️  PENTING: JANGAN SHARE wallets.json!`);
})();
EOF
