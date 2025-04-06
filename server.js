const express = require('express');
const fetch = require('node-fetch'); 
const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const cheerio = require('cheerio');
const path = require('path');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'debosmitapal429@gmail.com', // Replace with your email
        pass: 'capm saul tlfk efzs'          // Replace with your Gmail App Password
    }
});

const DATA_FILE = 'price_tracking.json';


async function initializeDataFile() {
    try {
        await fs.access(DATA_FILE);
    } catch (error) {
        await fs.writeFile(DATA_FILE, JSON.stringify([]));
    }
}


async function getProductPrice(url) {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }
        });
        const html = await response.text();
        const $ = cheerio.load(html);


        let price = $('.Nx9bqj.CxhGGd').first().text().trim() || 
                    $('._30jeq3').first().text().trim() || 
                    $('._1_WHN1').first().text().trim(); 
        
        console.log('Extracted price text:', price); 
        
        
        price = price.replace(/[^0-9.]/g, '');
        const priceNum = parseFloat(price) || 0;
        console.log('Parsed price:', priceNum);
        
        return priceNum;
    } catch (error) {
        console.error('Error fetching price:', error);
        return null;
    }
}


async function sendEmail(to, productUrl, currentPrice, targetPrice) {
    const mailOptions = {
        from: 'debosmitapal429@gmail.com',
        to: to,
        subject: 'Price Drop Alert!',
        text: `The price for ${productUrl} has dropped to ₹${currentPrice} (Your target was :  ₹${targetPrice}) Enjoy your shopping!...`
    };
    return transporter.sendMail(mailOptions);
}


app.post('/api/track', async (req, res) => {
    const { url, targetPrice, email } = req.body;
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        const trackingList = JSON.parse(data);

        trackingList.push({
            url,
            targetPrice: parseFloat(targetPrice),
            email,
            id: Date.now()
        });

        await fs.writeFile(DATA_FILE, JSON.stringify(trackingList));
        res.json({ success: true });


        await checkPrices();
    } catch (error) {
        res.status(500).json({ error: 'Failed to save tracking request' });
    }
});


async function checkPrices() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        let trackingList = JSON.parse(data);

        for (let item of trackingList) {
            console.log('Checking:', item.url, 'Target:', item.targetPrice);
            const currentPrice = await getProductPrice(item.url);
            console.log('Current price:', currentPrice);

            if (currentPrice && currentPrice <= item.targetPrice) {
                console.log('Sending email for:', item.url);
                await sendEmail(item.email, item.url, currentPrice, item.targetPrice);
                trackingList = trackingList.filter(t => t.id !== item.id);
                await fs.writeFile(DATA_FILE, JSON.stringify(trackingList));
            }
        }
    } catch (error) {
        console.error('Error checking prices:', error);
    }
}

async function startServer() {
    await initializeDataFile();
    setInterval(checkPrices, 3600000); 

    app.listen(3000, () => {
        console.log('Server running on port 3000');
    });
}

startServer();