/**
 * ===============================================
 *        EZCRYPTOIN ZUGCHAIN BOT V2.0 (WITH MENU)
 *    Enhanced with Wallet Generator & Referral System
 * ===============================================
 */

const axios = require('axios');
const chalk = require('chalk');
const Table = require('cli-table3');
const { ethers } = require('ethers');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const readline = require('readline');

// ============ CONFIG FILES ============
const config = require('./config.json');
let accounts = [];
let twoCaptchaApiKey = '';
try {
    const data = require('./accounts.json');
    if (Array.isArray(data)) {
        accounts = data;
    } else if (data.accounts) {
        accounts = data.accounts;
        twoCaptchaApiKey = data.twoCaptchaApiKey;
    }
} catch (e) {
    // Will be handled by menu system
}

// ============ FILE PATHS ============
const TOKENS_FILE = path.join(__dirname, 'tokens.json');
const FINGERPRINTS_FILE = path.join(__dirname, 'device_fingerprints.json');
const GENERATED_ACCOUNTS_FILE = path.join(__dirname, 'generated_accounts.json');

// ============ BANNER ============
function showBanner() {
    console.log(chalk.blue(`
                    _____ ___________ ________   _______ _____ _____ _____ _   _ 
|  ___|___  /  __ \| ___ \ \ / / ___ \_   _|  _  |_   _| \ | |
| |__    / /| /  \/| |_/ /\ V /| |_/ / | | | | | | | | |  \| |
|  __|  / / | |    |    /  \ / |  __/  | | | | | | | | | . ` |
| |___./ /__| \__/\| |\ \  | | | |     | | \ \_/ /_| |_| |\  |
\____/\_____/\____/\_| \_| \_/ \_|     \_/  \___/ \___/\_| \_/
                                                              
                                                              
    `));
    console.log(chalk.bold.cyan('    ====== EZCRYPTOIN AIRDROP ======'));
    console.log(chalk.bold.cyan('  ===== EZCRYPTOIN ZUGCHAIN V2.0 ====='));
    console.log(chalk.yellow('  [MENU MODE] - Choose your action below\n'));
}

// ============ DESKTOP USER AGENTS ============
const DESKTOP_USER_AGENTS = [
    { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', platform: 'Windows', secChUa: '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"' },
    { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36', platform: 'Windows', secChUa: '"Not(A:Brand";v="8", "Chromium";v="143", "Google Chrome";v="143"' },
    { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', platform: 'macOS', secChUa: '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"' },
    { ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', platform: 'Linux', secChUa: '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"' },
    { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0', platform: 'Windows', secChUa: '"Firefox";v="122"' }
];

// ============ SCREEN RESOLUTIONS ============
const SCREEN_RESOLUTIONS = [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1536, height: 864 },
    { width: 1440, height: 900 },
    { width: 1680, height: 1050 },
    { width: 2560, height: 1440 }
];

// ============ UTILITY FUNCTIONS ============
function loadJSON(filePath, defaultValue = {}) {
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (e) { }
    return defaultValue;
}

function saveJSON(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function generateDeterministicHash(input) {
    return crypto.createHash('sha256').update(input).digest('hex');
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max) {
    return Math.random() * (max - min) + min;
}

function randomDelay(baseDelay, variance = 0.3) {
    const variation = baseDelay * variance;
    return baseDelay + randomFloat(-variation, variation);
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function microPause() {
    const pause = randomInt(config.delays.microPauseMin, config.delays.microPauseMax);
    await sleep(pause);
}

function formatTimeLeft(seconds) {
    if (seconds <= 0) return 'Ready!';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}h ${m}m ${s}s`;
}

function shortAddress(address) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// ============ DEVICE FINGERPRINT ============
class DeviceFingerprint {
    constructor() {
        this.fingerprints = loadJSON(FINGERPRINTS_FILE, {});
    }

    generate(walletAddress) {
        const address = walletAddress.toLowerCase();
        if (this.fingerprints[address]) {
            return this.fingerprints[address];
        }

        const hash = generateDeterministicHash(address);
        const hashInt = parseInt(hash.slice(0, 8), 16);
        const uaIndex = hashInt % DESKTOP_USER_AGENTS.length;
        const selectedUA = DESKTOP_USER_AGENTS[uaIndex];
        const resIndex = parseInt(hash.slice(8, 16), 16) % SCREEN_RESOLUTIONS.length;
        const selectedRes = SCREEN_RESOLUTIONS[resIndex];
        const hardwareConcurrency = [4, 8, 12, 16][hashInt % 4];
        const deviceMemory = [4, 8, 16, 32][hashInt % 4];
        const canvasHash = hash.slice(0, 32);
        const webglHash = hash.slice(32, 64);

        const fingerprint = {
            userAgent: selectedUA.ua,
            platform: selectedUA.platform,
            secChUa: selectedUA.secChUa,
            screenWidth: selectedRes.width,
            screenHeight: selectedRes.height,
            hardwareConcurrency,
            deviceMemory,
            canvasHash,
            webglHash,
            deviceId: `zug_${hash.slice(0, 16)}`,
            createdAt: new Date().toISOString()
        };

        this.fingerprints[address] = fingerprint;
        this.save();
        return fingerprint;
    }

    save() {
        saveJSON(FINGERPRINTS_FILE, this.fingerprints);
    }

    get(walletAddress) {
        return this.fingerprints[walletAddress.toLowerCase()];
    }
}

// ============ PROXY HANDLER ============
function createProxyAgent(proxyUrl) {
    if (!proxyUrl) return null;
    try {
        return proxyUrl.startsWith('socks') ? 
            new SocksProxyAgent(proxyUrl) : 
            new HttpsProxyAgent(proxyUrl);
    } catch (e) {
        console.log(chalk.yellow(`[!] Invalid proxy: ${proxyUrl}`));
        return null;
    }
}

// ============ API CLIENT ============
class ZugChainClient {
    constructor(account, fingerprint, proxy = null) {
        this.account = account;
        this.fingerprint = fingerprint;
        this.wallet = new ethers.Wallet(account.privateKey);
        this.address = this.wallet.address;
        this.proxy = proxy;
        this.actionCount = 0;
        this.sessionStart = Date.now();

        this.axiosInstance = axios.create({
            baseURL: config.baseUrl,
            timeout: 30000,
            httpsAgent: createProxyAgent(proxy)
        });
    }

    log(msg, color = chalk.white) {
        console.log(color(`[${this.account.name || 'Account'}] ${msg}`));
    }

    getHeaders() {
        return {
            'accept': '*/*',
            'accept-encoding': 'gzip, deflate, br, zstd',
            'accept-language': 'en-US,en;q=0.9',
            'cache-control': 'no-cache',
            'content-type': 'application/json',
            'origin': config.baseUrl,
            'pragma': 'no-cache',
            'referer': `${config.baseUrl}/mission-control`,
            'sec-ch-ua': this.fingerprint.secChUa,
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': `"${this.fingerprint.platform}"`,
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'user-agent': this.fingerprint.userAgent
        };
    }

    async request(method, endpoint, data = null, retries = 0) {
        await microPause();
        try {
            const response = await this.axiosInstance({
                method,
                url: endpoint,
                data,
                headers: this.getHeaders()
            });
            return response.data;
        } catch (error) {
            const status = error.response?.status;
            const errData = error.response?.data || {};
            const errMsg = errData.error || errData.message || '';

            if (errMsg === 'Already completed' || (typeof errMsg === 'string' && errMsg.includes('Already'))) {
                return { success: true, message: 'Already completed', alreadyCompleted: true };
            }

            if ((status === 401 || status === 403) && retries < config.retry.maxRetries) {
                this.log(`Auth error, retrying...`, chalk.yellow);
                await sleep(config.retry.initialBackoffMs * Math.pow(2, retries));
                return this.request(method, endpoint, data, retries + 1);
            }

            if (retries < config.retry.maxRetries) {
                const backoff = Math.min(
                    config.retry.initialBackoffMs * Math.pow(2, retries),
                    config.retry.maxBackoffMs
                );
                this.log(`Request failed (${status || 'N/A'}), retry in ${backoff}ms...`, chalk.yellow);
                if (status === 400) {
                    this.log(`400 Bad Request Details: ${JSON.stringify(errData)}`, chalk.red);
                }
                await sleep(backoff);
                return this.request(method, endpoint, data, retries + 1);
            }
            throw error;
        }
    }

    async dummyTraffic() {
        const pages = config.dummyPages;
        const page = pages[randomInt(0, pages.length - 1)];
        try {
            await this.axiosInstance.get(page, { headers: this.getHeaders() });
            await sleep(randomDelay(1000));
        } catch (e) { }
    }

    async solveCaptcha(siteKey, url) {
        if (!twoCaptchaApiKey) {
            throw new Error('2Captcha API Key not found');
        }

        this.log(`Solving Captcha...`, chalk.white);
        const resIn = await axios.get(`http://2captcha.com/in.php?key=${twoCaptchaApiKey}&method=userrecaptcha&googlekey=${siteKey}&pageurl=${url}&json=1`);
        if (resIn.data.status !== 1) throw new Error(`2Captcha Error: ${resIn.data.request}`);
        const requestId = resIn.data.request;

        let attempts = 0;
        while (attempts < 30) {
            await sleep(5000);
            const resOut = await axios.get(`http://2captcha.com/res.php?key=${twoCaptchaApiKey}&action=get&id=${requestId}&json=1`);
            if (resOut.data.status === 1) {
                this.log(`Captcha Solved!`, chalk.green);
                return resOut.data.request;
            }
            if (resOut.data.request !== 'CAPCHA_NOT_READY') {
                throw new Error(`2Captcha Failed: ${resOut.data.request}`);
            }
            attempts++;
        }
        throw new Error('Captcha Timeout');
    }

    async getProfile() {
        return this.request('GET', `${config.api.profile}?address=${this.address}`);
    }

    async getMissions() {
        const timestamp = Date.now();
        return this.request('GET', `${config.api.missions}?address=${this.address}&_t=${timestamp}`);
    }

    async verifyMission(taskId, extraData = {}) {
        return this.request('POST', config.api.verify, {
            address: this.address,
            taskId,
            ...extraData
        });
    }

    async syncTransaction(txHash) {
        return this.request('POST', config.api.sync, {
            txHash,
            walletAddress: this.address
        });
    }

    async stakeZUG(missions = [], amount = '1') {
        const STAKING_CONTRACT = '0x4ed9828ba8487b9160C820C8b72c573E74eBbD0A';
        try {
            const stakeData = '0xc9c11fa9' +
                '0000000000000000000000000000000000000000000000000000000000000000' +
                '0000000000000000000000000000000000000000000000000000000000000000';

            this.log(`Staking ${amount} ZUG...`, chalk.white);
            const provider = new ethers.JsonRpcProvider(config.rpcUrl);
            const signer = this.wallet.connect(provider);
            const balance = await provider.getBalance(this.address);
            const requiredAmount = ethers.parseEther(amount);

            if (balance < requiredAmount) {
                this.log(`Insufficient balance for staking`, chalk.red);
                return false;
            }

            let gasLimit;
            try {
                gasLimit = await provider.estimateGas({
                    from: this.address,
                    to: STAKING_CONTRACT,
                    value: requiredAmount,
                    data: stakeData
                });
                gasLimit = gasLimit * 120n / 100n;
            } catch (e) {
                this.log(`Gas estimation failed, using default 300000`, chalk.yellow);
                gasLimit = 300000n;
            }

            const tx = {
                to: STAKING_CONTRACT,
                value: requiredAmount,
                gasLimit: gasLimit,
                data: stakeData
            };

            const response = await signer.sendTransaction(tx);
            this.log(`TX Sent: ${shortAddress(response.hash)}`, chalk.green);
            this.log(`Waiting for confirmation...`, chalk.white);
            const receipt = await response.wait(1);

            if (receipt.status === 0) {
                this.log(`Transaction reverted!`, chalk.red);
                return false;
            }
            this.log(`Confirmed in block ${receipt.blockNumber}`, chalk.green);

            this.log(`Syncing transaction with backend...`, chalk.white);
            let synced = false;
            let attempts = 0;
            await sleep(3000);

            while (attempts < 5) {
                try {
                    const syncRes = await this.syncTransaction(response.hash);
                    this.log(`Transaction synced`, chalk.green);
                    synced = true;
                    break;
                } catch (e) {
                    const msg = e.response?.data?.error || e.response?.data?.message || e.message;
                    this.log(`Sync attempt ${attempts + 1}/5: ${msg}`, chalk.yellow);
                    if (msg === 'Already completed' || msg.includes('already')) {
                        this.log(`Transaction already synced`, chalk.green);
                        synced = true;
                        break;
                    }
                }
                attempts++;
                if (attempts < 5) await sleep(5000);
            }

            if (!synced) {
                this.log(`Sync may have failed, but staking transaction is on-chain`, chalk.yellow);
            }
            this.log(`Staking completed! Points will be awarded in background.`, chalk.green);
            return true;
        } catch (e) {
            this.log(`Staking failed: ${e.message}`, chalk.red);
            if (e.message.includes('insufficient funds')) {
                this.log(`Need more ZUG to stake. Try claiming faucet first.`, chalk.yellow);
            }
            return false;
        }
    }

    async getStakingHistory() {
        const timestamp = `${Date.now()}_${Math.random()}`;
        return this.request('GET', `${config.api.stakingHistory}?address=${this.address}&type=ZUG&_t=${timestamp}`);
    }

    async syncUser(referralCode = '') {
        return this.request('POST', config.api.userSync, {
            address: this.address,
            referralCode
        });
    }

    findMissionId(missions, searchTitle) {
        if (!missions || !Array.isArray(missions)) return null;
        const task = missions.find(m => m.title.toLowerCase().includes(searchTitle.toLowerCase()));
        return task ? task.id : null;
    }

    async claimFaucet(missions = []) {
        try {
            this.log(`Claiming Faucet...`, chalk.white);
            const SITE_KEY = '6Lerk04sAAAAAJqTuhkaScWwo6LaUPI1ogZXwYo0';
            const FAUCET_PAGE = `${config.baseUrl}/faucet`;
            const captchaToken = await this.solveCaptcha(SITE_KEY, FAUCET_PAGE);
            const referralCode = config.referralCode || 'ZUG-J11YWX70';

            const faucetPayload = {
                address: this.address.toLowerCase(),
                recaptchaToken: captchaToken,
                referralCode: referralCode
            };

            let faucetSuccess = false;
            let alreadyClaimed = false;
            let faucetError = null;

            try {
                const result = await this.request('POST', '/api/faucet', faucetPayload);
                if (result.hash || result.txHash || result.transactionHash || result.success) {
                    const txHash = result.hash || result.txHash || result.transactionHash;
                    this.log(`Faucet tokens sent! TX: ${txHash ? txHash.slice(0, 10) + '...' : 'pending'}`, chalk.green);
                    faucetSuccess = true;
                    if (txHash) await this.waitForTransaction(txHash);
                    else await sleep(5000);
                    if (result.pointsEarned) {
                        this.log(`Points earned: +${result.pointsEarned}${result.multiplierApplied > 1 ? ` (${result.multiplierApplied}x boost)` : ''}`, chalk.green);
                    }
                    if (result.referralBonus) {
                        this.log(`Referral bonus applied!`, chalk.green);
                    }
                }
            } catch (e) {
                faucetError = e;
                const errData = e.response?.data || {};
                const msg = errData.error || errData.message || e.message;
                if (msg === 'COOLDOWN_ACTIVE' || msg.includes('COOLDOWN')) {
                    const timeLeft = errData.timeLeft;
                    const hours = timeLeft ? Math.floor(timeLeft / 3600) : '?';
                    this.log(`Faucet on cooldown: ${hours}h remaining`, chalk.yellow);
                    alreadyClaimed = true;
                } else if (msg && (msg.includes('already') || msg.includes('Already') || msg.includes('claimed') || msg.includes('limit'))) {
                    this.log(`Faucet already claimed: ${msg}`, chalk.yellow);
                    alreadyClaimed = true;
                } else {
                    this.log(`Faucet API error: ${msg}`, chalk.red);
                }
            }

            const taskId = 1;
            this.log(`Verifying Faucet Task (ID: ${taskId})...`, chalk.white);
            const verifyPayloads = [
                { address: this.address, taskId },
                { address: this.address, taskId, captchaToken: captchaToken },
                { address: this.address.toLowerCase(), taskId }
            ];

            let verified = false;
            let verifyError = null;
            for (const payload of verifyPayloads) {
                try {
                    const result = await this.request('POST', config.api.verify, payload);
                    if (result.success) {
                        this.log(`Faucet Task Verified! (+${result.points_awarded || 100} pts)`, chalk.green);
                        verified = true;
                        break;
                    } else if (result.message === 'Already completed' || result.error === 'Already completed') {
                        this.log(`Faucet Task Already Verified`, chalk.green);
                        verified = true;
                        break;
                    }
                } catch (e) {
                    verifyError = e;
                    const msg = e.response?.data?.error || e.response?.data?.message || e.message;
                    if (msg === 'Already completed' || (msg && msg.includes('Already'))) {
                        this.log(`Faucet Task Already Verified`, chalk.green);
                        return { success: true, alreadyClaimed: true };
                    }
                }
            }

            const provider = new ethers.JsonRpcProvider(config.rpcUrl);
            const balance = await provider.getBalance(this.address);
            const balanceZUG = ethers.formatEther(balance);
            this.log(`Current balance: ${balanceZUG} ZUG`, chalk.white);

            if (faucetSuccess || alreadyClaimed) return { success: true, alreadyClaimed };
            if (verified) return { success: true, verified };
            if (verifyError) throw verifyError;
            return { success: false };
        } catch (e) {
            const msg = e.response?.data?.error || e.response?.data?.message || e.message;
            this.log(`Faucet failed: ${msg}`, chalk.red);
            throw e;
        }
    }

    async waitForTransaction(txHash, timeout = 60000) {
        this.log(`Waiting for TX: ${txHash.slice(0, 10)}...`, chalk.gray);
        const startTime = Date.now();
        const provider = new ethers.JsonRpcProvider(config.rpcUrl);
        while (Date.now() - startTime < timeout) {
            try {
                const receipt = await provider.getTransactionReceipt(txHash);
                if (receipt) {
                    if (receipt.status === 1) {
                        this.log(`TX confirmed in block ${receipt.blockNumber}`, chalk.green);
                        return receipt;
                    } else {
                        this.log(`TX failed`, chalk.red);
                        return null;
                    }
                }
            } catch (e) { }
            await sleep(3000);
        }
        this.log(`TX confirmation timeout`, chalk.yellow);
        return null;
    }

    shouldTakeCooldown() {
        return this.actionCount >= config.scheduler.maxActionsPerSession;
    }

    incrementAction() {
        this.actionCount++;
    }

    resetSession() {
        this.actionCount = 0;
        this.sessionStart = Date.now();
    }
}

// ============ ACCOUNT SCHEDULER ============
class AccountScheduler {
    constructor(account, fingerprintManager) {
        this.account = account;
        this.fingerprintManager = fingerprintManager;
        this.client = null;
        this.nextRunTime = Date.now();
        this.lastProfile = null;
        this.lastMissions = null;
        this.isRunning = false;
        this.stats = {
            totalPoints: 0,
            pointsDiff: 0,
            dailyCompleted: false,
            socialCompleted: 0,
            onchainCompleted: 0,
            tokenExpiry: 'N/A'
        };
    }

    log(msg, color = chalk.white) {
        console.log(color(`[${this.account.name}] ${msg}`));
    }

    async initialize() {
        try {
            const wallet = new ethers.Wallet(this.account.privateKey);
            const fingerprint = this.fingerprintManager.generate(wallet.address);
            this.client = new ZugChainClient(this.account, fingerprint, this.account.proxy);
            this.log(`Initialized: (${shortAddress(wallet.address)})`, chalk.green);
            return true;
        } catch (e) {
            this.log(`Failed to init: ${e.message}`, chalk.red);
            return false;
        }
    }

    async run() {
        if (this.isRunning || Date.now() < this.nextRunTime) return;
        this.isRunning = true;
        try {
            this.log(`Processing...`, chalk.cyan);
            await this.client.dummyTraffic();
            await sleep(randomDelay(config.delays.minDelay));
            const profile = await this.client.getProfile();
            const previousPoints = this.stats.totalPoints;
            this.stats.totalPoints = parseInt(profile.points) || 0;
            this.stats.pointsDiff = this.stats.totalPoints - previousPoints;
            this.log(`Points: ${this.stats.totalPoints} | Rank: #${profile.rank || 'N/A'}`, chalk.white);
            await sleep(randomDelay(config.delays.betweenTasks));
            const missionsData = await this.client.getMissions();
            let missions = [], streaks = null;
            try {
                if (missionsData && typeof missionsData === 'object' && missionsData.missions) {
                    missions = missionsData.missions;
                    streaks = missionsData.streaks;
                } else if (missionsData && missionsData.text) {
                    const decoded = JSON.parse(Buffer.from(missionsData.text, 'base64').toString());
                    missions = decoded.missions || [];
                    streaks = decoded.streaks;
                } else if (typeof missionsData === 'string') {
                    const decoded = JSON.parse(Buffer.from(missionsData, 'base64').toString());
                    missions = decoded.missions || [];
                    streaks = decoded.streaks;
                }
            } catch (e) {
                this.log(`Failed to parse missions: ${e.message}`, chalk.yellow);
                missions = [];
            }

            const todayDate = new Date().toISOString().split('T')[0];
            let faucetDone = false;
            let lastFaucetDate = null;
            if (streaks) {
                lastFaucetDate = streaks.last_faucet_date ? streaks.last_faucet_date.split('T')[0] : null;
                faucetDone = (lastFaucetDate === todayDate);
            }

            try {
                await this.client.syncUser();
            } catch (e) { }

            if (!faucetDone) {
                try {
                    this.log(`Attempting Faucet Claim...`, chalk.white);
                    const res = await this.client.claimFaucet(missions);
                    if (res && res.success) {
                        faucetDone = true;
                        this.log(`Faucet Status: SUCCESS`, chalk.green);
                    } else if (res && res.alreadyClaimed) {
                        faucetDone = true;
                    }
                } catch (e) {
                    this.log(`Faucet failed: ${e.message}`, chalk.red);
                }
            } else {
                this.log(`Faucet already claimed today`, chalk.green);
            }

            let stakingDone = false;
            if (streaks && streaks.last_stake_date) {
                const lastStake = streaks.last_stake_date.split('T')[0];
                if (lastStake === todayDate) stakingDone = true;
            }

            const stakingMissionId = this.client.findMissionId(missions, 'Secure the Network') ||
                this.client.findMissionId(missions, 'Stake');

            if (!stakingDone && stakingMissionId) {
                const missionObj = missions.find(m => m.id === stakingMissionId);
                if (missionObj && missionObj.is_completed) stakingDone = true;
            }

            if (stakingMissionId && !stakingDone) {
                try {
                    this.log(`Daily Staking...`, chalk.white);
                    const stakeRes = await this.client.stakeZUG(missions);
                    if (stakeRes) {
                        stakingDone = true;
                        this.log(`Staking Status: SUCCESS`, chalk.green);
                    }
                } catch (e) {
                    this.log(`Staking error: ${e.message}`, chalk.red);
                }
            }

            this.stats.dailyCompleted = (faucetDone && stakingDone);
            let completedTasks = 0;
            this.stats.socialCompleted = 0;
            for (const m of missions) {
                if (m.is_completed && m.type === 'SOCIAL') this.stats.socialCompleted++;
            }

            this.log(`Missions Loaded: ${missions.length} | Daily Status: ${this.stats.dailyCompleted ? '✅' : '❌'}`, chalk.white);

            for (const mission of missions) {
                if (this.client.shouldTakeCooldown()) {
                    this.log(`Session limit reached, taking cooldown...`, chalk.yellow);
                    break;
                }
                if (mission.is_completed) continue;
                if (mission.verification_type === 'API_VERIFY') continue;
                if (mission.type === 'DAILY') continue;
                if (mission.verification_type === 'LINK_CLICK' && mission.requires_verification) {
                    try {
                        await microPause();
                        this.log(`Verifying: ${mission.title}`, chalk.white);
                        const result = await this.client.verifyMission(mission.id);
                        if (result.success) {
                            this.log(`Completed: ${mission.title} (+${result.points_awarded || mission.reward_points} pts)`, chalk.green);
                            this.stats.socialCompleted++;
                            completedTasks++;
                            this.client.incrementAction();
                        }
                        await sleep(randomDelay(config.delays.betweenTasks));
                    } catch (e) {
                        this.log(`Skip: ${mission.title} - ${e.response?.data?.message || e.message}`, chalk.yellow);
                    }
                }
            }

            if (completedTasks > 0) {
                await sleep(randomDelay(config.delays.minDelay));
                const finalProfile = await this.client.getProfile();
                this.stats.totalPoints = parseInt(finalProfile.points) || this.stats.totalPoints;
            }
            this.log(`Done! Total: ${this.stats.totalPoints} pts`, chalk.green);
        } catch (e) {
            this.log(`Error: ${e.message}`, chalk.red);
        }
        this.scheduleNextRun();
        this.isRunning = false;
    }

    scheduleNextRun() {
        const now = new Date();
        const targetHourUTC = 0;
        const targetMinuteUTC = 30;
        let nextRun = new Date(now);
        nextRun.setUTCHours(targetHourUTC, targetMinuteUTC, 0, 0);
        if (nextRun <= now) nextRun.setDate(nextRun.getDate() + 1);
        const jitter = randomInt(-15, 15) * 60 * 1000;
        this.nextRunTime = nextRun.getTime() + jitter;
        const nextRunDate = new Date(this.nextRunTime);
        this.stats.nextRun = nextRunDate.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
    }

    getStats() {
        return {
            name: this.account.name,
            address: this.client ? shortAddress(this.client.address) : 'N/A',
            points: this.stats.totalPoints,
            diff: this.stats.pointsDiff >= 0 ? `+${this.stats.pointsDiff}` : `${this.stats.pointsDiff}`,
            daily: this.stats.dailyCompleted ? '✅' : '❌',
            social: `${this.stats.socialCompleted}/10`,
            onchain: `${this.stats.onchainCompleted}`,
            nextRun: this.stats.nextRun || 'Ready',
            tokenExp: this.stats.tokenExpiry
        };
    }
}

// ============ MAIN BOT ============
class ZugChainBot {
    constructor() {
        this.fingerprintManager = new DeviceFingerprint();
        this.schedulers = [];
        this.isRunning = false;
    }

    async initialize() {
        console.log(chalk.cyan('[*] Initializing ZugChain Bot...'));
        console.log();
        if (accounts.length === 0) {
            console.log(chalk.red('[!] No accounts found'));
            process.exit(1);
        }
        console.log(chalk.white(`[*] Loading ${accounts.length} account(s)...`));
        console.log();
        for (const account of accounts) {
            const scheduler = new AccountScheduler(account, this.fingerprintManager);
            const success = await scheduler.initialize();
            if (success) this.schedulers.push(scheduler);
            await sleep(500);
        }
        console.log();
        console.log(chalk.green(`[✓] Initialized ${this.schedulers.length}/${accounts.length} accounts`));
        console.log();
    }

    printSummaryTable() {
        console.log('\n' + chalk.bold.cyan('================================================================================'));
        console.log(chalk.bold.cyan(`                          🤖 SIPAL ZUGCHAIN V2.0 🤖`));
        console.log(chalk.bold.cyan('================================================================================'));
        const table = new Table({
            head: ['Account', 'Points', 'Status', 'Daily', 'Next Run'],
            style: { head: ['cyan'], border: ['grey'] }
        });
        for (const scheduler of this.schedulers) {
            const stats = scheduler.getStats();
            table.push([
                stats.name,
                stats.points,
                stats.diff !== '0' ? stats.diff : 'Hold',
                stats.daily,
                stats.nextRun
            ]);
        }
        console.log(table.toString());
        console.log(chalk.bold.cyan('================================================================================\n'));
    }

    async runCycle() {
        console.log(chalk.cyan(`\n[*] Starting cycle at ${new Date().toLocaleTimeString()}`));
        for (const scheduler of this.schedulers) {
            if (Date.now() >= scheduler.nextRunTime) {
                await scheduler.run();
                await sleep(randomDelay(config.delays.betweenAccounts));
            }
        }
        this.printSummaryTable();
    }

    async start() {
        await this.initialize();
        for (const scheduler of this.schedulers) {
            scheduler.nextRunTime = Date.now();
        }
        await this.runCycle();
        this.isRunning = true;
        while (this.isRunning) {
            await sleep(60 * 1000);
            const needsRun = this.schedulers.some(s => Date.now() >= s.nextRunTime);
            if (needsRun) {
                await this.runCycle();
            } else {
                const nextRuns = this.schedulers.map(s => s.nextRunTime);
                const soonest = Math.min(...nextRuns);
                const waitTime = Math.max(0, soonest - Date.now());
                console.log(chalk.grey(`[~] Next check in ${formatTimeLeft(waitTime / 1000)}`));
            }
        }
    }

    stop() {
        this.isRunning = false;
        console.log(chalk.yellow('\n[!] Bot stopped'));
    }
}

// ============ MENU SYSTEM ============
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function showMainMenu() {
    showBanner();
    console.log(chalk.bold.cyan('MAIN MENU'));
    console.log(chalk.white('1.') + ' Create random wallets (max 5) with referral');
    console.log(chalk.white('2.') + ' Run bot with manual private keys');
    console.log(chalk.white('3.') + ' Exit');
    const choice = await askQuestion(chalk.yellow('\nSelect an option (1-3): '));
    
    switch(choice.trim()) {
        case '1':
            await createWallets();
            break;
        case '2':
            await runWithManualKeys();
            break;
        case '3':
            rl.close();
            process.exit(0);
        default:
            console.log(chalk.red('\nInvalid option!'));
            await showMainMenu();
    }
}

async function createWallets() {
    console.log(chalk.bold.cyan('\n=== WALLET GENERATOR ==='));
    const countStr = await askQuestion(chalk.yellow('How many wallets to create (1-5)? '));
    const count = parseInt(countStr);
    
    if (isNaN(count) || count < 1 || count > 5) {
        console.log(chalk.red('Invalid number! Must be between 1-5.'));
        await showMainMenu();
        return;
    }

    const wallets = [];
    const referralCode = 'ZUG-J11YWX70';
    console.log(chalk.green(`\nGenerating ${count} wallets with referral code: ${referralCode}\n`));
    
    for (let i = 0; i < count; i++) {
        const wallet = ethers.Wallet.createRandom();
        wallets.push(wallet);
        
        console.log(chalk.bold(`Wallet #${i + 1}:`));
        console.log(chalk.yellow(`Private Key: ${wallet.privateKey}`));
        console.log(chalk.cyan(`Address: ${wallet.address}`));
        console.log(chalk.white(`Referral Link: https://testnet.zugchain.org/?ref=${referralCode}`));
        console.log();
    }

    // Save to file
    const accountData = wallets.map((w, i) => ({
        privateKey: w.privateKey,
        name: `Generated Wallet ${i + 1}`,
        address: w.address
    }));
    
    try {
        fs.writeFileSync(GENERATED_ACCOUNTS_FILE, JSON.stringify(accountData, null, 2));
        console.log(chalk.green(`✓ Wallets saved to ${GENERATED_ACCOUNTS_FILE}`));
    } catch (e) {
        console.log(chalk.yellow(`⚠️  Could not save wallets to file: ${e.message}`));
    }

    // Sync with referral system
    console.log(chalk.white('\nSyncing wallets with referral system...'));
    const fingerprintManager = new DeviceFingerprint();
    let syncedCount = 0;
    
    for (let i = 0; i < wallets.length; i++) {
        try {
            const fingerprint = fingerprintManager.generate(wallets[i].address);
            const client = new ZugChainClient(
                { privateKey: wallets[i].privateKey, name: `Wallet ${i + 1}` },
                fingerprint,
                null
            );
            await client.syncUser(referralCode);
            console.log(chalk.green(`✓ Wallet ${i + 1} synced with referral!`));
            syncedCount++;
            await sleep(1500);
        } catch (e) {
            console.log(chalk.red(`✗ Failed to sync wallet ${i + 1}: ${e.message}`));
        }
    }

    console.log(chalk.bold.cyan(`\n${syncedCount}/${count} wallets successfully registered with referral!`));
    console.log(chalk.yellow('IMPORTANT: Save your private keys securely! They will not be shown again.'));
    
    const runBot = await askQuestion(chalk.yellow('\nRun bot for these wallets now? (y/n): '));
    if (runBot.toLowerCase() === 'y') {
        await runBotWithAccounts(accountData);
    } else {
        await showMainMenu();
    }
}

async function runWithManualKeys() {
    console.log(chalk.bold.cyan('\n=== MANUAL ACCOUNT ENTRY ==='));
    const accountsArray = [];
    
    for (let i = 0; i < 5; i++) {
        const pk = await askQuestion(chalk.yellow(`Enter private key for account #${i + 1} (or press Enter to finish): `));
        if (!pk.trim()) break;
        accountsArray.push({ 
            privateKey: pk.trim(), 
            name: `Manual Account ${i + 1}` 
        });
    }

    if (accountsArray.length === 0) {
        console.log(chalk.red('No accounts entered!'));
        await showMainMenu();
        return;
    }

    let apiKey = await askQuestion(chalk.yellow(`Enter 2Captcha API Key (default: 353f18d6c354057eec7d89e6a3f9b171): `));
    if (!apiKey.trim()) {
        apiKey = '353f18d6c354057eec7d89e6a3f9b171';
        console.log(chalk.green(`Using default API key`));
    }

    await runBotWithAccounts(accountsArray, apiKey);
}

async function runBotWithAccounts(accountList, apiKey = null) {
    // Set global variables
    accounts = accountList;
    if (apiKey) twoCaptchaApiKey = apiKey;
    
    console.log(chalk.green(`\n✓ Starting bot with ${accounts.length} account(s)...`));
    console.log(chalk.yellow('Press CTRL+C to stop the bot at any time\n'));
    
    // Start bot
    const bot = new ZugChainBot();
    try {
        await bot.start();
    } catch (e) {
        console.log(chalk.red(`\nFatal error: ${e.message}`));
        rl.close();
        process.exit(1);
    }
}

// ============ GRACEFUL SHUTDOWN ============
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\n[!] Shutting down gracefully...'));
    rl.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log(chalk.yellow('\n[!] Shutting down...'));
    rl.close();
    process.exit(0);
});

// ============ START MENU ============
(async () => {
    try {
        await showMainMenu();
    } catch (e) {
        console.log(chalk.red(`\nError: ${e.message}`));
        rl.close();
        process.exit(1);
    }
})();
