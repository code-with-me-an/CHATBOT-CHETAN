document.addEventListener("DOMContentLoaded", () => {
    const userInput = document.getElementById("user-input");
    const sendButton = document.getElementById("send-button");
    const aiRoastButton = document.getElementById("ai-roast-button");
    const chatWindow = document.getElementById("chat-window");
    const exitButton = document.getElementById("exit-button");
    const messageModal = document.getElementById("message-modal");
    const closeModalButton = document.getElementById("close-modal-button");
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    let currentAudioSource = null;

    function addMessage(
        text,
        sender,
        imageUrl = null,
        movieTitle = null,
        roastText
    ) {
        const messageContainer = document.createElement("div");
        messageContainer.classList.add(
            "message-container",
            sender === "user" ? "user-message-container" : "bot-message-container"
        );

        const messageBox = document.createElement("div");
        messageBox.classList.add(
            "message-box",
            sender === "user" ? "user-message-box" : "bot-message-box"
        );

        if (text) {
            const p = document.createElement("p");
            p.textContent = text;
            messageBox.appendChild(p);
        }

        if (imageUrl) {
            const img = document.createElement("img");
            img.src = imageUrl;
            img.alt = "Movie Scene";
            img.classList.add("roast-image");
            img.onerror = () => {
                img.src = `https://placehold.co/600x300/fff8e1/333333?text=Image+Not+Found`;
                img.alt = "Image not found";
            };
            messageBox.appendChild(img);
        }

        if (movieTitle) {
            const title = document.createElement("p");
            title.textContent = `- ${movieTitle}`;
            title.classList.add("roast-movie-title");
            messageBox.appendChild(title);
        }
        if (sender === "bot" && roastText) {
            const actionContainer = document.createElement("div");
            actionContainer.classList.add("message-actions");

            const readButton = document.createElement("button");
            readButton.classList.add("action-button");
            readButton.innerHTML = "Read Roast 🔊";
            readButton.addEventListener("click", () => {
                handleTTS(readButton, roastText);
            });
            actionContainer.appendChild(readButton);
            messageBox.appendChild(actionContainer);
        }

        messageContainer.appendChild(messageBox);
        chatWindow.appendChild(messageContainer);

        chatWindow.scrollTop = chatWindow.scrollHeight;
        return messageBox;
    }
    function pcmToWav(pcmData, sampleRate) {
        const pcm16 = new Int16Array(pcmData);
        const dataLength = pcm16.length * 2;
        const buffer = new ArrayBuffer(44 + dataLength);
        const view = new DataView(buffer);
        let offset = 0;

        function writeString(str) {
            for (let i = 0; i < str.length; i++) {
                view.setUint8(offset++, str.charCodeAt(i));
            }
        }

        function writeUint32(val) {
            view.setUint32(offset, val, true);
            offset += 4;
        }

        function writeUint16(val) {
            view.setUint16(offset, val, true);
            offset += 2;
        }

        writeString("RIFF");
        writeUint32(36 + dataLength);
        writeString("WAVE");
        writeString("fmt ");
        writeUint32(16);
        writeUint16(1);
        writeUint16(1);
        writeUint32(sampleRate);
        writeUint32(sampleRate * 2);
        writeUint16(2);
        writeUint16(16);
        writeString("data");
        writeUint32(dataLength);

        for (let i = 0; i < pcm16.length; i++) {
            view.setInt16(offset, pcm16[i], true);
            offset += 2;
        }

        return new Blob([view], { type: "audio/wav" });
    }

    function base64ToArrayBuffer(base64) {
        const binaryString = window.atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }

    async function handleTTS(button, textToSpeak) {
        if (currentAudioSource) {
            currentAudioSource.stop();
            currentAudioSource = null;
        }

        button.disabled = true;
        const originalText = button.innerHTML;
        button.innerHTML = `
                    <div class="tts-loading-dots">
                        <div class="tts-loading-dot"></div>
                        <div class="tts-loading-dot"></div>
                        <div class="tts-loading-dot"></div>
                    </div>
                `;

        try {
            const payload = {
                contents: [
                    {
                        parts: [{ text: textToSpeak }],
                    },
                ],
                generationConfig: {
                    responseModalities: ["AUDIO"],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: "Rasalgethi" },
                        },
                    },
                },
                model: "gemini-2.5-flash-preview-tts",
            };
            const apiKey = "AIzaSyBWBfYjlDRpHQ22Ua9rPC960hP2gn_5aDg";
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;

            let response;
            for (let i = 0; i < 5; i++) {
                response = await fetch(apiUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                if (response.status !== 429) break;
                await new Promise((resolve) =>
                    setTimeout(resolve, Math.pow(2, i) * 1000)
                );
            }

            if (!response.ok) {
                throw new Error(`TTS API failed with status: ${response.status}`);
            }

            const result = await response.json();
            const part = result?.candidates?.[0]?.content?.parts?.[0];
            const audioData = part?.inlineData?.data;
            const mimeType = part?.inlineData?.mimeType;

            if (audioData && mimeType && mimeType.startsWith("audio/")) {
                const sampleRateMatch = mimeType.match(/rate=(\d+)/);
                const sampleRate = sampleRateMatch
                    ? parseInt(sampleRateMatch[1], 10)
                    : 16000;
                const pcmData = base64ToArrayBuffer(audioData);
                const wavBlob = pcmToWav(pcmData, sampleRate);
                const audioUrl = URL.createObjectURL(wavBlob);

                const audio = new Audio(audioUrl);
                audio.play();

                audio.onended = () => {
                    button.disabled = false;
                    button.innerHTML = originalText;
                };
            } else {
                throw new Error("Invalid TTS response");
            }
        } catch (error) {
            console.error("Error generating TTS:", error);
            button.disabled = false;
            button.innerHTML = "Error";
            setTimeout(() => (button.innerHTML = originalText), 2000);
        }
    }

    const roasts = [
        {
            dialogue: "നീ പോലീസിനെ പറഞ്ഞു മനസ്സിലാക്ക് വക്കീലുമായി വരാം",
            movie: "Christian Brothers",
            image: "https://keralakaumudi.com/web-news/en/2024/09/NMAN0530524/image/suresh-krishna-dubai-jose.1727103772.webp"
        },
        {
            dialogue: "എന്തൊക്കെ ബഹളമായിരുന്നു... മേൽശാന്തി, കീഴ്ശാന്തി, പോമ പോമ...",
            movie: "Kilukkam",
            image: "https://i.pinimg.com/736x/17/3e/65/173e65b5d55f40214d11f4024078c446.jpg",
        },
        {
            dialogue: "അങ്ങനെ പവനായി ശവമായി.",
            movie: "Nadodikkattu",
            image:
                "https://imgs.search.brave.com/UOIhHMWKUWR-cQI9unuU2pBcdMcGS_UvW3mVvZnXAek/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9tZWRp/YS5hc3NldHR5cGUu/Y29tL3RubS9pbXBv/cnQvc2l0ZXMvZGVm/YXVsdC9maWxlcy9O/YWRvZGlrYXR0dV8x/MjAwLTgwMF8xLmpw/Zz93PTQ4MCZhdXRv/PWZvcm1hdCxjb21w/cmVzcyZmaXQ9bWF4",
        },
        {
            dialogue: "നീ പോ മോനേ ദിനേശാ",
            movie: "Narasimham",
            image:
                "https://images.filmibeat.com/webp/img/2017/06/22-1498125229-narasimham-1.jpg",
        },
        {
            dialogue: "ഒന്നുമില്ല,കുട്ടിക്ക് ഒന്നുമില്ല ആടികൊള്ളൂ നേരം വെളുക്കും വരെ ആടിക്കൊള്ളും",
            movie: "Manichitrathazhu",
            image:
                "https://images.news18.com/malayalam/uploads/2021/01/Manichithrathazhu.jpg?im=FitAndFill,width=1200,height=900",
        },
        {
            dialogue: "ഇതെന്തിന്റെ കേടാ...?",
            movie: "Manichitrathazhu",
            image:
                "https://i.ytimg.com/vi/RKvnym004oA/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLA-kzmjqg2hWJfKivJsO_lYqkI5Vw",
        },
        {
            dialogue: "ഇപ്പൊ ശരിയാക്കി തരാം.",
            movie: "Sandesham",
            image:
                "https://img.onmanorama.com/content/dam/mm/en/news/kerala/images/2020/1/16/poland-prabhakaran.jpg?w=1120&h=583",
        },
        {
            dialogue: "സിംപിൾ ആയിട്ട് പറഞ്ഞാൽ... ഊള.",
            movie: "Oru Vadakkan Selfie",
            image: "https://filmyexp.wordpress.com/wp-content/uploads/2015/03/n1.jpg",
        },
        {
            dialogue: "അയ്യോ! അച്ഛാ പോകല്ലേ...",
            movie: "Godfather",
            image:
                "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQW3aPJe6PTbgaQzElih0Pi9bDefGqz2c6Fqw&s",
        },
        {
            dialogue: "ഓർമ്മയുണ്ടോ ഈ മുഖം?",
            movie: "Commissioner",
            image:
                "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRf_s1KdByPHdTxXm0Yrd-KuKU2PK4ZNSxSrg&s",
        },
        {
            dialogue: "കമ്പിത്തിരി, പൂത്തിരി, ഓലപ്പടക്കം... കത്തിക്കാൻ ലൈറ്റർ എവിടെ?",
            movie: "Thilakkam",
            image:
                "https://i.ytimg.com/vi/Hq8M29K5clA/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLBcieBsI5di7npzvENSvZOyNJpcSQ",
        },
        {
            dialogue: "വെൽക്കം ടു ഊട്ടി, ഫൈൻ!",
            movie: "Kakkakuyil",
            image: "https://pbs.twimg.com/media/EQQAdmOU4AAYWEz.jpg",
        },
        {
            dialogue: "നമ്മൾ അനാഥരാണ് പക്ഷെ ഗുണ്ടകൾ അല്ല",
            movie: "Kummatikali",
            image: "https://i.ytimg.com/vi/GAi_oN4izUk/maxresdefault.jpg",
        },
        {
            dialogue:
                "തമ്പുരാട്ടിയുടെ കൂടെ റോയല്‍ ഡിന്നറിന് പോയപ്പോ നീ എന്താടാ പറഞ്ഞത്? ‘ഡു നോട്ട് മിസണ്ടര്‍സ്റ്റാന്‍ഡ് മീ’ അല്ലേ? ഞാന്‍ മിസണ്ടര്‍സ്റ്റാന്‍ ആവുമട ",
            movie: "Kakkakuyil",
            image: "https://pbs.twimg.com/media/EQQAdmOU4AAYWEz.jpg",
        },
    ];

    function handleStaticRoast() {
        const userText = userInput.value.trim();

        if (userText) {
            addMessage(userText, "user");
            userInput.value = "";
            sendButton.disabled = true;
            aiRoastButton.disabled = true;

            const loadingContainer = document.createElement("div");
            loadingContainer.classList.add(
                "message-container",
                "bot-message-container"
            );
            const loadingDots = document.createElement("div");
            loadingDots.classList.add("loading-dots");
            loadingDots.innerHTML =
                '<i class="fas fa-circle"></i><i class="fas fa-circle"></i><i class="fas fa-circle"></i>';
            loadingContainer.appendChild(loadingDots);
            chatWindow.appendChild(loadingContainer);
            chatWindow.scrollTop = chatWindow.scrollHeight;

            setTimeout(() => {
                loadingContainer.remove();

                const randomRoast = roasts[Math.floor(Math.random() * roasts.length)];

                addMessage(
                    randomRoast.dialogue,
                    "bot",
                    randomRoast.image,
                    randomRoast.movie,
                    randomRoast.dialogue
                );

                sendButton.disabled = false;
                aiRoastButton.disabled = false;
                userInput.focus();
            }, 1500);
        }
    }

    async function handleAIRoast() {
        const userText = userInput.value.trim();
        if (userText === "") return;

        addMessage(userText, "user");
        userInput.value = "";
        sendButton.disabled = true;
        aiRoastButton.disabled = true;

        const loadingContainer = document.createElement("div");
        loadingContainer.classList.add(
            "message-container",
            "bot-message-container"
        );
        const loadingDots = document.createElement("div");
        loadingDots.classList.add("loading-dots");
        loadingDots.innerHTML =
            '<i class="fas fa-circle"></i><i class="fas fa-circle"></i><i class="fas fa-circle"></i>';
        loadingContainer.appendChild(loadingDots);
        chatWindow.appendChild(loadingContainer);
        chatWindow.scrollTop = chatWindow.scrollHeight;

        try {
            const prompt = `You are an AI that acts as a popular "Malayalam Roast Bot" named Chetan. Your persona is witty, sarcastic, and slightly arrogant, like a classic Malayalam movie villain. Your task is to provide a short, funny, and clever "roast" in the Malayalam language in response to the user's input. The roast should be based on a famous Malayalam movie dialogue or character, but it should be a new, original roast, not a direct quote. Make it brief and sharp. Your response should be a JSON object with two fields: "dialogue" (the roast text in Malayalam) and "movie" (the Malayalam movie it's inspired by). Do not include an image. 
                    
                    Example:
                    User: എന്നെ റോസ്റ്റ് ചെയ്യ്.
                    Response:
                    {
                      "dialogue": "ഞാൻ പോയാലും എന്റെ റോസ്റ്റുകൾ ഇവിടെ കാണും. നിന്റെ ഫോട്ടോ എടുക്കാൻ മാത്രം ഞാൻ നിൽക്കില്ല.",
                      "movie": "Pulimurugan"
                    }
                    
                    Now, roast the following user input: "${userText}"`;

            const payload = {
                contents: [
                    {
                        parts: [{ text: prompt }],
                    },
                ],
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "OBJECT",
                        properties: {
                            dialogue: { type: "STRING" },
                            movie: { type: "STRING" },
                        },
                        propertyOrdering: ["dialogue", "movie"],
                    },
                },
            };
            const apiKey = "AIzaSyBWBfYjlDRpHQ22Ua9rPC960hP2gn_5aDg";
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

            let response;
            for (let i = 0; i < 5; i++) {
                response = await fetch(apiUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                if (response.status !== 429) break;
                await new Promise((resolve) =>
                    setTimeout(resolve, Math.pow(2, i) * 1000)
                );
            }

            if (!response.ok) {
                throw new Error(`API failed with status: ${response.status}`);
            }
            const result = await response.json();
            const jsonString = result.candidates[0].content.parts[0].text;
            const parsedJson = JSON.parse(jsonString);

            loadingContainer.remove();
            addMessage(
                parsedJson.dialogue,
                "bot",
                null,
                parsedJson.movie,
                parsedJson.dialogue
            );
        } catch (error) {
            console.error("Gemini API Error:", error);
            loadingContainer.remove();
            addMessage(
                "ക്ഷമിക്കണം, എനിക്ക് ഇപ്പോൾ റോസ്റ്റ് ചെയ്യാൻ പറ്റുന്നില്ല. കുറച്ചു കഴിഞ്ഞു ശ്രമിക്കൂ.",
                "bot",
                null,
                null,
                "ക്ഷമിക്കണം, എനിക്ക് ഇപ്പോൾ റോസ്റ്റ് ചെയ്യാൻ പറ്റുന്നില്ല. കുറച്ചു കഴിഞ്ഞു ശ്രമിക്കൂ."
            );
        } finally {
            sendButton.disabled = false;
            aiRoastButton.disabled = false;
            userInput.focus();
        }
    }

    function handleExit() {
        messageModal.classList.add("visible");
    }

    function handleUserInput(event) {
        const userText = userInput.value.trim();
        if ((event.key === "Enter" || event.type === "click") && userText) {
            if (userText.toLowerCase() === "quit") {
                handleExit();
                userInput.value = "";
            } else {
                handleStaticRoast();
            }
        }
    }

    sendButton.addEventListener("click", handleUserInput);
    aiRoastButton.addEventListener("click", handleAIRoast);
    userInput.addEventListener("keypress", handleUserInput);

    exitButton.addEventListener("click", handleExit);
    closeModalButton.addEventListener("click", () => {
        messageModal.classList.remove("visible");
    });

    messageModal.addEventListener("click", (event) => {
        if (event.target === messageModal) {
            messageModal.classList.remove("visible");
        }
    });
});
const shareTitle = 'Check out this awesome page!';
const shareUrl = window.location.href;
const encodedText = encodeURIComponent(`${shareTitle}\n\n${shareUrl}`);
const whatsappLink = `https://api.whatsapp.com/send?text=${encodedText}`;
const whatsappButton = document.getElementById('whatsapp-share');
whatsappButton.setAttribute('href', whatsappLink);