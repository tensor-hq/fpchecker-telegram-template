//@ts-nocheck
const { Telegraf } = require('telegraf');
const Markup = require("telegraf/markup");
const axios =  require('axios');

// Telegram bot token
const bot = new Telegraf('BOT_TOKEN');
// Tensor API key
const API_KEY = "TENSOR_API_KEY";
// Marketplace base URL with "/" at the end, so concatenated with mint address it will redirect to the single NFT buy page
const BASE_URL = "https://www.tensor.trade/item/";
// Amount of listings to fetch
const NUM_OF_LISTINGS = 10;

// The following vars are currently global, might make sense to not requery each time a user starts the bot/refreshes
// so a local DB with periodical refetches or (even better) websocket subscriptions to keep listings up-to-date are 
// wayyyy better options, but that's up to you to play around with and optimize!! 
var mintsWithIndices = [];
var royaltiesEnabledPerUser = {};

// on /start or /Start => set royaltiesEnabled for the current user if not given, fetch tensor API and send reply
bot.command("start", ctx => {
  const userId = ctx.from.id;
  royaltiesEnabledPerUser[userId] = royaltiesEnabledPerUser[userId] || false;
  fetchAndReply(ctx)
});
bot.command("Start", ctx => {
  const userId = ctx.from.id;
  royaltiesEnabledPerUser[userId] = royaltiesEnabledPerUser[userId] || false;
  fetchAndReply(ctx)
});

// when a user clicks on "Return to Main Menu" Button on single listing views, refetch and reply with Menu
bot.action('back_to_start', ctx => fetchAndReply(ctx));

// when a user selects a listing via index (parsed via RegEx), fetch current mint by index and send single NFT view as reply
bot.action(/select_(\d+)/, async (ctx) => {
  try {
    const index = ctx.match[1];
    const currentMint = mintsWithIndices.find(mint => mint.index === parseInt(index) + 1);
    await sendSingleNFTReply(ctx, currentMint);
  } catch (error) {
    console.error('Error in command handler:', error);
    ctx.reply('Try to restart the bot with /start')
  }
})

// toggles royalties for the user on/off
bot.action("toggleRoyalties", ctx => {
  royaltiesEnabledPerUser[ctx.from.id] = !royaltiesEnabledPerUser[ctx.from.id];
  fetchAndReply(ctx);
});

// start the bot
bot.launch({
  "dropPendingUpdates": true
}).then(() => {
  console.log('Bot started');
});

// fetch floor listings via tensor API
async function fetchFloorListings(ctx) {
  try {
    // slug: tensorians slug || sortBy: ListingPriceAsc || limit: NUM_OF_LISTINGS ( default 10 ) || onlyListings: True
    const URL = `https://api.mainnet.tensordev.io/api/v1/mint/collection?slug=05c52d84-2e49-4ed9-a473-b43cab41e777&sortBy=ListingPriceAsc&limit=${NUM_OF_LISTINGS}&onlyListings=true`;
    const response = await axios.get(
      URL,
      {
        "headers": {
          "x-tensor-api-key": API_KEY
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error when trying to fetch tensor API: ', error);
    ctx.reply('An error occurred. Please try again later.');
  }
}

// reply with the info of the currentMint object that got returned from the API
async function sendSingleNFTReply(ctx, currentMint) {

  // if royalties are enabled, adjust price and define end of caption accordingly
  const royaltiesEnabled = royaltiesEnabledPerUser[ctx.from.id];
  const price = getAdjustedPrice(currentMint, royaltiesEnabled);
  const royaltyInfoMessage = royaltiesEnabled ? "incl. royalties/fees" : "excl. royalties/fees";
  // send reply with image, caption and buttons
  ctx.replyWithPhoto({
    // reply with image with the imageUri from API return
    url: currentMint.imageUri
  }, {
    caption: `<b><u>${currentMint.index}. lowest listing: </u></b> \n${currentMint.name} listed at ${price} S◎L ${royaltyInfoMessage}.`,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          // indices are off by one, so "select_0" would select the mint with index 1 (1st lowest listing)
          { text: "←", callback_data: `select_${currentMint.index - 2 < 0 ? NUM_OF_LISTINGS - 1 : (currentMint.index - 2)}` },
          // clicking on BUY will directly redirect to the marketplace given by the BASE_URL concatenated with the mint address
          { text: "BUY", url: `${BASE_URL}${currentMint.mint}` },
          // next mint is mod NUM_OF_LISTINGS, so if current mint index is 10, go to "select_0" (1st lowest listing - off by one) 
          { text: "→", callback_data: `select_${(currentMint.index % NUM_OF_LISTINGS)}` },
        ],
        [
          { text: "Back to Main Menu", callback_data: "back_to_start" }
        ]
      ]
    }
  }
  )
}

// fetches floor listings from tensor API and constructs reply (overview) for the bot to send
async function fetchAndReply(ctx) {
  try {

    // check if user enabled royalties and define royalty button thusly
    const royaltiesEnabled = royaltiesEnabledPerUser[ctx.from.id];
    var royaltyToggle;
    if (royaltiesEnabled) {
      royaltyToggle = Markup.button.callback("Royalties/Marketplace Fees: ON ✅", "toggleRoyalties");
    } else {
      royaltyToggle = Markup.button.callback("Royalties/Marketplace Fees: OFF ❌", "toggleRoyalties");
    }

    // fetch floor listings from API
    const data = await fetchFloorListings(ctx);
    const mints = data.mints;
    // maps mints to corresponding index and stores it globally ( improvable ;) )
    mintsWithIndices = mints.map((mint, index) => ({ ...mint, index: index + 1 }));
    // constructs a button for each mint
    const buttons = mintsWithIndices.map(mint => Markup.button.callback(mint.index, `select_${mint.index - 1}`));
    // defines "back to menu" button
    const backToMenuButton = Markup.button.callback("Refresh", "back_to_start");
    // initialize keyboard (all buttons) with the mint buttons first... 
    const keyboard = Markup.inlineKeyboard(buttons, { columns: 5 });
    // ... and add "back to menu" button and royalty button in the next rows
    keyboard.reply_markup.inline_keyboard = [...keyboard.reply_markup.inline_keyboard, [backToMenuButton], [royaltyToggle]];
    // potentially adjusts prices if royalties enabled and maps from lamports => SOL with 3 fixed digits
    const prices = mintsWithIndices.map(mint => getAdjustedPrice(mint, royaltiesEnabled));
    // construct message
    const message = mintsWithIndices.map((mint, i) => `${mint.index}. ${mint.name} is listed for ${prices[i]} S◎L.`).join('\n');
    // reply with message and keyboard (buttons)
    ctx.reply(message, keyboard);
  } catch (error) {
    ctx.reply('An error occurred. Please try again later.');
  }
}

// helper function that potentially adjusts prices if royalties enabled and maps from lamports => SOL with 3 fixed digits
// if royalties are enabled: multiply price by fixed platform fee (1.5%) and royalties for the specific NFT via royaltyBps
// 1 BPS == 0.01%
function getAdjustedPrice(currentMint, royaltiesEnabled) {
  const potentiallyAdjustedPrice = royaltiesEnabled ? Number(currentMint.listing.price) * (1 + 0.015 + (currentMint.royaltyBps / 10_000)) : Number(currentMint.listing.price);
  return (potentiallyAdjustedPrice / 1_000_000_000).toFixed(3);
}
