# Telegram Bot Template

**Welcome to the Telegram Bot Template!**

This demo provides a simple foundation for working with the Tensor API, use it to get started building NOW!


 Menu View | Single NFT View 
:-:|:-:
![Sample Screenshot Menu View](https://github.com/tensor-hq/fpchecker-telegram-template/blob/main/menuView.JPG?raw=true) |![Sample Screenshot Single View](https://github.com/tensor-hq/fpchecker-telegram-template/blob/main/singleView.JPG?raw=true)




### Prerequisites

- Node v18.18.0 or higher
- Tensor API Key [Request Page](https://tensor.readme.io/page/tensor-api-form)
- Telegram API Key [Telegram Bots](https://core.telegram.org/bots#how-do-i-create-a-bot)

### Installation

#### Clone the repo

```shell
git clone tensor-hq/fpchecker-telegram-template
cd fpchecker-telegram-template
```

#### Install Dependencies

```shell
npm install
```

#### Set environment variables in .env
```
// Telegram bot token
BOT_TOKEN=
// Tensor API key
const API_KEY=
// Marketplace base URL with "/" at the end, so concatenated with mint address it will redirect to the single NFT buy page
BASE_URL=
// Amount of listings to fetch
NUM_OF_LISTINGS=
// Slug of collection to fetch FP
SLUG=
```

#### Start the bot

```
npx ts-node main.ts
```

#### Interact with the bot
Visit the telegram url with the name specified during BotFather signup
