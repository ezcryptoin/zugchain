#!/usr/bin/env node

const ethers = require('ethers');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ==================== CONFIGURATION ====================
const CONFIG_FILE = './config.json';
const WALLET_FILE = './wallets.json';
const LOG_FILE = './bot.log';

const config = require(CONFIG_FILE);
let wallets = loadWallets();

// ==================== HELPERS ====================

// Logging dengan timestamp
const log = (...args) => {
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] ${args.join(' ')}`;
  console.log(message);
  fs.appendFileSync(LOG_FILE, message + '\n');
};

// Random delay
const randomDelay = (min, max) => 
  new Promise(res => setTimeout(res, Math.floor(Math.random() * (max - min + 1)) + min));

// Exponential backoff
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const withRetry = async (fn, retries = config.retry.maxRetries, backoff = config.retry.initialBackoffMs) => {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries) throw error;
      
      const wait = Math.min(backoff * Math.pow(2, i), config.retry.maxBackoffMs);
      log(`⚠️  Retry ${i + 1}/${retries} dalam ${wait}ms...`);
      await sleep(wait);
    }
  }
};

// Load/Save wallets
function loadWallets() {
  if (fs.existsSync(WALLET_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(WALLET_FILE, 'utf8'));
    } catch (e) {
      log('❌ Error loading wallets.json, creating new...');
    }
  }
  return [];
}

function saveWallets() {
  fs.writeFileSync(WALLET_FILE, JSON.stringify(wallets, null, 2));
}

// ==================== API FUNCTIONS ====================

// Sync user dengan referral
async function syncUserWithReferral(address) {
  return withRetry(async () => {
    const res = await axios.post(
      `${config.baseUrl}${config.api.userSync}`,
      { address },
      {
        params: { ref: config.referralCode },
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return res.data;
  });
}

// Claim faucet
async function claimFaucet(address) {
  return withRetry(async () => {
    const res = await axios.post(
      `${config.baseUrl}${config.api.faucet}`,
      { address },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return res.data;
  });
}

// Get profile
async function getProfile(address) {
  return withRetry(async () => {
    const res = await axios.get(
      `${config.baseUrl}${config.api.profile}`,
      {
        params: { address },
        timeout: 10000
      }
    );
    return res.data;
  });
}

// Dummy page visit (anti-detect)
async function visitDummyPage() {
  const page = config.dummyPages[Math.floor(Math.random() * config.dummyPages.length)];
  await randomDelay(config.delays.microPauseMin, config.delays.microPauseMax);
}

// ==================== WALLET MANAGEMENT ====================

function createWallet() {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    createdAt: new Date().toISOString(),
    status: 'pending'
  };
}

// ==================== MAIN BOT LOGIC ====================

async function processWallet(wallet) {
  try {
    log(`\n[${wallets.indexOf(wallet) + 1}] Processing: ${wallet.address}`);

    // 1. Sync dengan referral
    log(`  🔄 Sync dengan referral...`);
    const syncResult = await syncUserWithReferral(wallet.address);
    log(`  ✅ Sync berhasil`);

    // 2. Claim faucet
    log(`  💧 Claim faucet...`);
    await claimFaucet(wallet.address);
    log(`  ✅ Faucet claimed`);

    // 3. Get profile (opsional)
    log(`  📊 Get profile...`);
    const profile = await getProfile(wallet.address);
    log(`  ✅ Profile loaded - Points: ${profile?.points || 'N/A'}`);

    // 4. Dummy page visit
    await visitDummyPage();

    wallet.status = 'success';
    wallet.processedAt = new Date().toISOString();
    wallet.profile = profile;

    log(`  🎉 Wallet ${wallet.address} selesai!`);

    return true;
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    log(`  ❌ Error: ${msg}`);
    
    if (msg.includes('already registered') || msg.includes('duplicate')) {
      wallet.status = 'duplicate';
      wallet.error = msg;
      return false;
    }

    wallet.status = 'failed';
    wallet.error = msg;
    return false;
  }
}

async function runBot(targetCount) {
  log('🚀 ========================================');
  log(`🚀 Bot Auto-Referral Zugchain Testnet`);
  log(`🔗 Referral Code: ${config.referralCode}`);
  log(`🎯 Target: ${targetCount} wallet baru`);
  log(`📊 Existing wallets: ${wallets.length}`);
  log('🚀 ========================================\n');

  // Batasi maksimal per run
  if (targetCount > config.safety.maxWalletsPerRun) {
    log(`⚠️  Dibatasi ke ${config.safety.maxWalletsPerRun} wallet/run`);
    targetCount = config.safety.maxWalletsPerRun;
  }

  let successCount = 0;
  let duplicateCount = 0;
  let failedCount = 0;

  for (let i = 0; i < targetCount; i++) {
    // Buat wallet baru
    const wallet = createWallet();
    wallets.push(wallet);
    
    // Proses wallet
    const success = await processWallet(wallet);
    
    if (success) {
      successCount++;
    } else if (wallet.status === 'duplicate') {
      duplicateCount++;
    } else {
      failedCount++;
    }

    // Simpan progres setiap 5 wallet
    if ((i + 1) % 5 === 0) {
      saveWallets();
      log(`💾 Progress saved (${i + 1}/${targetCount})`);
    }

    // Delay antar akun
    if (i < targetCount - 1) {
      const delay = config.delays.betweenAccounts;
      log(`⏳ Delay ${delay}ms...\n`);
      await randomDelay(delay, delay + 2000);
    }
  }

  // Simpan final
  saveWallets();

  // Ringkasan
  log('\n' + '='.repeat(50));
  log('✅ SELESAI — Ringkasan:');
  log(`   Total diproses : ${targetCount}`);
  log(`   Berhasil       : ${successCount}`);
  log(`   Duplicate      : ${duplicateCount}`);
  log(`   Gagal          : ${failedCount}`);
  log(`   Total tersimpan: ${wallets.length} wallet`);
  log('='.repeat(50));
  log(`\n📁 Private keys: ${WALLET_FILE}`);
  log(`📄 Log: ${LOG_FILE}`);
}

// ==================== SCHEDULER (Opsional) ====================

async function schedulerMode() {
  log('⏰ Scheduler mode aktif...');
  log(`🔄 Check interval: ${config.scheduler.checkIntervalMinutes} menit`);
  
  while (true) {
    const now = new Date();
    const currentHour = now.getHours();
    
    // Reset counter setiap hari
    if (currentHour === config.scheduler.dailyResetHour) {
      log('📅 Daily reset...');
      wallets = [];
      saveWallets();
    }

    // Jalankan bot
    const target = config.scheduler.maxActionsPerSession;
    await runBot(target);

    // Tunggu interval berikutnya
    const minutes = config.scheduler.checkIntervalMinutes;
    log(`⏳ Tunggu ${minutes} menit untuk sesi berikutnya...\n`);
    await sleep(minutes * 60 * 1000);
  }
}

// ==================== CLI ARGUMENTS ====================

(async () => {
  try {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
      console.log(`
Usage:
  node bot.js [count]          Run bot dengan jumlah wallet tertentu
  node bot.js scheduler        Run dalam mode scheduler (otomatis)
  node bot.js --help           Tampilkan bantuan ini

Examples:
  node bot.js 100              Buat 100 wallet baru
  node bot.js 500              Buat 500 wallet baru
  node bot.js scheduler        Mode auto-run tiap ${config.scheduler.checkIntervalMinutes} menit
      `);
      return;
    }

    if (args.includes('scheduler')) {
      await schedulerMode();
    } else {
      const count = args[0] ? parseInt(args[0]) : null;
      
      if (!count || isNaN(count) || count <= 0) {
        console.log('🚀 Bot Auto-Referral Zugchain');
        console.log(`🔗 Referral: ${config.referralCode}\n`);
        console.log('❓ Berapa wallet yang ingin dibuat?');
        
        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        const answer = await new Promise(resolve => {
          readline.question('Jumlah: ', (input) => {
            readline.close();
            resolve(input.trim());
          });
        });
        
        const num = parseInt(answer);
        if (!num || isNaN(num) || num <= 0) {
          console.log('❌ Input tidak valid. Gunakan: node bot.js 100');
          return;
        }
        
        await runBot(num);
      } else {
        await runBot(count);
      }
    }
  } catch (error) {
    log(`\n❌ Fatal error: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
})();
