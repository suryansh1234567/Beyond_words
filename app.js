document.addEventListener('DOMContentLoaded', async () => {
    // -------------------------------------------------------------
    // 1. DOM Elements
    // -------------------------------------------------------------
    const videoElement = document.getElementsByClassName('input_video')[0];
    const canvasElement = document.getElementsByClassName('output_canvas')[0];
    const canvasCtx = canvasElement.getContext('2d');
    
    const detectedText = document.getElementById('detected-text');
    const detectedSubtext = document.getElementById('detected-subtext');
    const accuracyFill = document.getElementById('accuracy-fill');
    const accuracyText = document.getElementById('accuracy-text');

    const sentenceDisplayText = document.getElementById('sentence-display-text');
    const ttsSpeakBtn = document.getElementById('tts-speak-btn');
    const sentenceSpaceBtn = document.getElementById('sentence-space-btn');
    const sentenceBackspaceBtn = document.getElementById('sentence-backspace-btn');
    const sentenceClearBtn = document.getElementById('sentence-clear-btn');

    // -------------------------------------------------------------
    // 1.5 Custom KNN Engine (Machine Learning)
    // -------------------------------------------------------------
    let customDataset = JSON.parse(localStorage.getItem('customDataset')) || [];
    let latestHandLandmarks = null;
    
    const customAiLabelInput = document.getElementById('custom-ai-label');
    const customAiCaptureBtn = document.getElementById('custom-ai-capture-btn');
    const customAiCountText = document.getElementById('custom-ai-count');
    
    if (customAiCountText) customAiCountText.innerText = customDataset.length;
    renderDictionaryUI();
    
    // Normalize landmarks to be scale and translation invariant
    function normalizeLandmarks(landmarks) {
        if (!landmarks || landmarks.length === 0) return null;
        
        // Find the wrist (point 0)
        const wrist = landmarks[0];
        
        // Translate all points relative to wrist
        let translated = landmarks.map(p => {
            return { x: p.x - wrist.x, y: p.y - wrist.y, z: p.z - wrist.z };
        });
        
        // Find max distance from wrist to scale down
        let maxDist = 0;
        for (let p of translated) {
            let dist = Math.sqrt(p.x*p.x + p.y*p.y + p.z*p.z);
            if (dist > maxDist) maxDist = dist;
        }
        
        // Scale all points
        if (maxDist > 0) {
            translated = translated.map(p => {
                return { x: p.x / maxDist, y: p.y / maxDist, z: p.z / maxDist };
            });
        }
        return translated;
    }

    // Calculate Euclidean distance between two normalized hand shapes
    function calculateDistance(normA, normB) {
        let sum = 0;
        for (let i = 0; i < normA.length; i++) {
            let dx = normA[i].x - normB[i].x;
            let dy = normA[i].y - normB[i].y;
            let dz = normA[i].z - normB[i].z;
            sum += dx*dx + dy*dy + dz*dz;
        }
        return Math.sqrt(sum);
    }
    
    // Predict sign using KNN (K=3 Majority Voting)
    function predictCustomSign(liveLandmarks) {
        if (customDataset.length === 0) return null;
        
        const normLive = normalizeLandmarks(liveLandmarks);
        if (!normLive) return null;
        
        // Calculate distance to all saved samples
        let distances = [];
        for (let item of customDataset) {
            let dist = calculateDistance(normLive, item.landmarks);
            distances.push({ label: item.label, distance: dist });
        }
        
        // Sort by distance (closest first)
        distances.sort((a, b) => a.distance - b.distance);
        
        // Take top 3
        const k = Math.min(3, distances.length);
        const topK = distances.slice(0, k);
        
        // Majority Voting (Require distance < 0.35 threshold)
        let voteCount = {};
        for (let match of topK) {
            if (match.distance > 0.35) continue; 
            voteCount[match.label] = (voteCount[match.label] || 0) + 1;
        }
        
        // Find winner
        let bestMatch = null;
        let maxVotes = 0;
        for (let label in voteCount) {
            if (voteCount[label] > maxVotes) {
                maxVotes = voteCount[label];
                bestMatch = label;
            }
        }
        
        if (bestMatch) {
            // Find the closest distance for the winning label to calculate similarity %
            let closestDistForWinner = distances.find(d => d.label === bestMatch).distance;
            let conf = Math.max(0, 100 - (closestDistForWinner * 150)); 
            return { name: bestMatch, score: conf };
        }
        return null;
    }

    // Capture Button Logic (Samples 5 frames rapidly)
    if (customAiCaptureBtn) {
        customAiCaptureBtn.addEventListener('click', () => {
            const label = customAiLabelInput.value.trim().toUpperCase();
            if (!label) {
                alert("Please enter a word first!");
                return;
            }
            if (!latestHandLandmarks) {
                alert("Please hold your hand in front of the camera!");
                return;
            }
            
            customAiCaptureBtn.innerHTML = `Capturing...`;
            customAiCaptureBtn.disabled = true;
            
            let samplesCaptured = 0;
            const captureInterval = setInterval(() => {
                if (latestHandLandmarks) {
                    const normLandmarks = normalizeLandmarks(latestHandLandmarks);
                    customDataset.push({
                        label: label,
                        landmarks: normLandmarks
                    });
                    samplesCaptured++;
                }
                
                if (samplesCaptured >= 5) {
                    clearInterval(captureInterval);
                    localStorage.setItem('customDataset', JSON.stringify(customDataset));
                    
                    customAiLabelInput.value = "";
                    customAiCountText.innerText = customDataset.length;
                    
                    renderDictionaryUI();
                    
                    customAiCaptureBtn.disabled = false;
                    customAiCaptureBtn.innerHTML = `<ion-icon name="checkmark-outline"></ion-icon> Saved!`;
                    customAiCaptureBtn.style.background = "var(--success)";
                    setTimeout(() => {
                        customAiCaptureBtn.innerHTML = `<ion-icon name="camera-outline"></ion-icon> Capture`;
                        customAiCaptureBtn.style.background = "";
                    }, 2000);
                }
            }, 100); // 5 captures over 500ms
        });
    }

    function renderDictionaryUI() {
        const dictList = document.getElementById('dynamic-dictionary-list');
        if (!dictList) return;
        
        if (customDataset.length > 0) {
            dictList.innerHTML = "";
            const uniqueLabels = [...new Set(customDataset.map(item => item.label))];
            uniqueLabels.forEach(label => {
                const dictItem = document.createElement('div');
                dictItem.className = 'dict-item';
                dictItem.style = 'padding: 10px; background: rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 8px; border-left: 3px solid var(--success);';
                dictItem.innerHTML = `<strong style="color: var(--primary);">${label}</strong><br><span style="font-size: 0.85rem; color: #a1a1aa;">KNN Model</span>`;
                dictList.appendChild(dictItem);
            });
            dictList.scrollTop = dictList.scrollHeight;
        }
    }

    // -------------------------------------------------------------
    // 2. Gesture Definitions (Fingerpose)
    // -------------------------------------------------------------
    
    // HELLO (Open Palm)
    const signHello = new fp.GestureDescription('HELLO');
    for(let finger of [fp.Finger.Thumb, fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
        signHello.addCurl(finger, fp.FingerCurl.NoCurl, 1.0);
        signHello.addDirection(finger, fp.FingerDirection.VerticalUp, 1.0);
        signHello.addDirection(finger, fp.FingerDirection.DiagonalUpLeft, 0.9);
        signHello.addDirection(finger, fp.FingerDirection.DiagonalUpRight, 0.9);
    }

    // PEACE (V Sign)
    const signPeace = new fp.GestureDescription('PEACE');
    signPeace.addCurl(fp.Finger.Index, fp.FingerCurl.NoCurl, 1.0);
    signPeace.addDirection(fp.Finger.Index, fp.FingerDirection.VerticalUp, 1.0);
    signPeace.addDirection(fp.Finger.Index, fp.FingerDirection.DiagonalUpLeft, 0.9);
    signPeace.addDirection(fp.Finger.Index, fp.FingerDirection.DiagonalUpRight, 0.9);
    
    signPeace.addCurl(fp.Finger.Middle, fp.FingerCurl.NoCurl, 1.0);
    signPeace.addDirection(fp.Finger.Middle, fp.FingerDirection.VerticalUp, 1.0);
    signPeace.addDirection(fp.Finger.Middle, fp.FingerDirection.DiagonalUpLeft, 0.9);
    signPeace.addDirection(fp.Finger.Middle, fp.FingerDirection.DiagonalUpRight, 0.9);
    for(let finger of [fp.Finger.Thumb, fp.Finger.Ring, fp.Finger.Pinky]) {
        signPeace.addCurl(finger, fp.FingerCurl.FullCurl, 1.0);
        signPeace.addCurl(finger, fp.FingerCurl.HalfCurl, 0.9);
    }

    // I LOVE YOU (Thumb, Index, Pinky extended)
    const signILoveYou = new fp.GestureDescription('I LOVE YOU');
    for (let finger of [fp.Finger.Thumb, fp.Finger.Index, fp.Finger.Pinky]) {
        signILoveYou.addCurl(finger, fp.FingerCurl.NoCurl, 1.0);
    }
    for (let finger of [fp.Finger.Middle, fp.Finger.Ring]) {
        signILoveYou.addCurl(finger, fp.FingerCurl.FullCurl, 1.0);
        signILoveYou.addCurl(finger, fp.FingerCurl.HalfCurl, 0.9);
    }

    // YES (Fist with head nod - simulated by just fist)
    const signYes = new fp.GestureDescription('YES');
    for (let finger of [fp.Finger.Thumb, fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
        signYes.addCurl(finger, fp.FingerCurl.FullCurl, 1.0);
        signYes.addCurl(finger, fp.FingerCurl.HalfCurl, 0.9);
    }

    // NO (Thumb, Index, Middle extended forward)
    const signNo = new fp.GestureDescription('NO');
    for (let finger of [fp.Finger.Thumb, fp.Finger.Index, fp.Finger.Middle]) {
        signNo.addCurl(finger, fp.FingerCurl.NoCurl, 1.0);
    }
    for (let finger of [fp.Finger.Ring, fp.Finger.Pinky]) {
        signNo.addCurl(finger, fp.FingerCurl.FullCurl, 1.0);
        signNo.addCurl(finger, fp.FingerCurl.HalfCurl, 0.9);
    }

    // OK (Thumb and Index curved, others extended)
    const signOk = new fp.GestureDescription('OK');
    signOk.addCurl(fp.Finger.Thumb, fp.FingerCurl.HalfCurl, 1.0);
    signOk.addCurl(fp.Finger.Index, fp.FingerCurl.HalfCurl, 1.0);
    for (let finger of [fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
        signOk.addCurl(finger, fp.FingerCurl.NoCurl, 1.0);
        signOk.addDirection(finger, fp.FingerDirection.VerticalUp, 1.0);
    }

    // CALL ME (Thumb and Pinky extended)
    const signCallMe = new fp.GestureDescription('CALL ME');
    for (let finger of [fp.Finger.Thumb, fp.Finger.Pinky]) {
        signCallMe.addCurl(finger, fp.FingerCurl.NoCurl, 1.0);
    }
    for (let finger of [fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring]) {
        signCallMe.addCurl(finger, fp.FingerCurl.FullCurl, 1.0);
        signCallMe.addCurl(finger, fp.FingerCurl.HalfCurl, 0.9);
    }

    // ROCK ON (Index and Pinky extended)
    const signRockOn = new fp.GestureDescription('ROCK ON');
    for (let finger of [fp.Finger.Index, fp.Finger.Pinky]) {
        signRockOn.addCurl(finger, fp.FingerCurl.NoCurl, 1.0);
        signRockOn.addDirection(finger, fp.FingerDirection.VerticalUp, 1.0);
    }
    for (let finger of [fp.Finger.Thumb, fp.Finger.Middle, fp.Finger.Ring]) {
        signRockOn.addCurl(finger, fp.FingerCurl.FullCurl, 1.0);
        signRockOn.addCurl(finger, fp.FingerCurl.HalfCurl, 0.9);
    }

    // NUMBER 1 (Index extended)
    const signOne = new fp.GestureDescription('NUMBER 1');
    signOne.addCurl(fp.Finger.Index, fp.FingerCurl.NoCurl, 1.0);
    signOne.addDirection(fp.Finger.Index, fp.FingerDirection.VerticalUp, 1.0);
    for (let finger of [fp.Finger.Thumb, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
        signOne.addCurl(finger, fp.FingerCurl.FullCurl, 1.0);
        signOne.addCurl(finger, fp.FingerCurl.HalfCurl, 0.9);
    }

    // NUMBER 3 (Thumb, Index, Middle extended)
    const signThree = new fp.GestureDescription('NUMBER 3');
    for (let finger of [fp.Finger.Thumb, fp.Finger.Index, fp.Finger.Middle]) {
        signThree.addCurl(finger, fp.FingerCurl.NoCurl, 1.0);
        signThree.addDirection(finger, fp.FingerDirection.VerticalUp, 1.0);
        signThree.addDirection(finger, fp.FingerDirection.DiagonalUpLeft, 0.9);
        signThree.addDirection(finger, fp.FingerDirection.DiagonalUpRight, 0.9);
    }
    for (let finger of [fp.Finger.Ring, fp.Finger.Pinky]) {
        signThree.addCurl(finger, fp.FingerCurl.FullCurl, 1.0);
        signThree.addCurl(finger, fp.FingerCurl.HalfCurl, 0.9);
    }

    // NUMBER 4 (Index, Middle, Ring, Pinky extended; Thumb curled)
    const signFour = new fp.GestureDescription('NUMBER 4');
    for (let finger of [fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
        signFour.addCurl(finger, fp.FingerCurl.NoCurl, 1.0);
        signFour.addDirection(finger, fp.FingerDirection.VerticalUp, 1.0);
        signFour.addDirection(finger, fp.FingerDirection.DiagonalUpLeft, 0.9);
        signFour.addDirection(finger, fp.FingerDirection.DiagonalUpRight, 0.9);
    }
    signFour.addCurl(fp.Finger.Thumb, fp.FingerCurl.FullCurl, 1.0);
    signFour.addCurl(fp.Finger.Thumb, fp.FingerCurl.HalfCurl, 0.9);
    // --- NEW: THUMBS UP (GOOD) ---
    const signThumbsUp = new fp.GestureDescription('GOOD / THUMBS UP');
    signThumbsUp.addCurl(fp.Finger.Thumb, fp.FingerCurl.NoCurl, 1.0);
    signThumbsUp.addDirection(fp.Finger.Thumb, fp.FingerDirection.VerticalUp, 1.0);
    signThumbsUp.addDirection(fp.Finger.Thumb, fp.FingerDirection.DiagonalUpRight, 0.9);
    signThumbsUp.addDirection(fp.Finger.Thumb, fp.FingerDirection.DiagonalUpLeft, 0.9);
    for(let finger of [fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
        signThumbsUp.addCurl(finger, fp.FingerCurl.FullCurl, 1.0);
        signThumbsUp.addCurl(finger, fp.FingerCurl.HalfCurl, 0.9);
    }

    // --- NEW: THUMBS DOWN (BAD) ---
    const signThumbsDown = new fp.GestureDescription('BAD / THUMBS DOWN');
    signThumbsDown.addCurl(fp.Finger.Thumb, fp.FingerCurl.NoCurl, 1.0);
    signThumbsDown.addDirection(fp.Finger.Thumb, fp.FingerDirection.VerticalDown, 1.0);
    signThumbsDown.addDirection(fp.Finger.Thumb, fp.FingerDirection.DiagonalDownRight, 0.9);
    signThumbsDown.addDirection(fp.Finger.Thumb, fp.FingerDirection.DiagonalDownLeft, 0.9);
    for(let finger of [fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring, fp.Finger.Pinky]) {
        signThumbsDown.addCurl(finger, fp.FingerCurl.FullCurl, 1.0);
        signThumbsDown.addCurl(finger, fp.FingerCurl.HalfCurl, 0.9);
    }

    // --- NEW: WATER ('W' Handshape) ---
    const signWater = new fp.GestureDescription('WATER');
    // Index, Middle, Ring are straight up
    for(let finger of [fp.Finger.Index, fp.Finger.Middle, fp.Finger.Ring]) {
        signWater.addCurl(finger, fp.FingerCurl.NoCurl, 1.0);
        signWater.addDirection(finger, fp.FingerDirection.VerticalUp, 1.0);
    }
    // Thumb and Pinky are curled
    signWater.addCurl(fp.Finger.Pinky, fp.FingerCurl.FullCurl, 1.0);
    signWater.addCurl(fp.Finger.Pinky, fp.FingerCurl.HalfCurl, 0.9);
    signWater.addCurl(fp.Finger.Thumb, fp.FingerCurl.FullCurl, 1.0);
    signWater.addCurl(fp.Finger.Thumb, fp.FingerCurl.HalfCurl, 0.9);

    // Initialize Estimator
    const estimator = new fp.GestureEstimator([
        signHello, signPeace, signILoveYou, signYes, signNo, signOk,
        signCallMe, signRockOn, signThumbsUp, signThumbsDown, signWater
    ]);

    // -------------------------------------------------------------
    // 3. Sentence Builder Logic
    // -------------------------------------------------------------
    let sentenceBuffer = "";
    
    // Timer logic to lock in a word
    let detectingGesture = null;
    let detectionStartTime = 0;
    const HOLD_TIME_REQUIRED = 1500; // 1.5 seconds

    function appendToSentence(word) {
        if (!word) return;
        
        if (sentenceBuffer.length === 0) {
            sentenceBuffer = word;
        } else {
            sentenceBuffer += " " + word;
        }
        updateSentenceDisplay();
    }

    function updateSentenceDisplay() {
        if (sentenceBuffer.trim().length === 0) {
            sentenceDisplayText.innerHTML = `<span class="placeholder-text">Signed words will automatically append here...</span>`;
        } else {
            sentenceDisplayText.innerText = sentenceBuffer;
        }
    }

    function speakText(text) {
        if (!('speechSynthesis' in window) || !text) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9; // Slightly slower for clarity
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
    }

    ttsSpeakBtn.addEventListener('click', () => {
        if (sentenceBuffer.trim()) {
            speakText(sentenceBuffer);
        }
    });

    sentenceSpaceBtn.addEventListener('click', () => {
        sentenceBuffer += " ";
        updateSentenceDisplay();
    });

    sentenceBackspaceBtn.addEventListener('click', () => {
        // If last is space, remove it. Otherwise remove last word/char.
        sentenceBuffer = sentenceBuffer.trimEnd();
        const lastSpace = sentenceBuffer.lastIndexOf(' ');
        if (lastSpace !== -1) {
            sentenceBuffer = sentenceBuffer.slice(0, lastSpace);
        } else {
            sentenceBuffer = "";
        }
        updateSentenceDisplay();
    });

    sentenceClearBtn.addEventListener('click', () => {
        sentenceBuffer = "";
        updateSentenceDisplay();
    });

    // -------------------------------------------------------------
    // 4. MediaPipe Camera Loop & UI Updates
    // -------------------------------------------------------------
    async function onResults(results) {
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        
        // Draw video frame
        canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
            
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];
            latestHandLandmarks = landmarks; // Save for KNN Training
            
            // Draw skeleton
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: 'rgba(99, 102, 241, 0.85)', lineWidth: 4});
            drawLandmarks(canvasCtx, landmarks, {color: '#67e8f9', lineWidth: 2, radius: 4});
            
            // Convert MediaPipe landmarks for Fingerpose (multiply by canvas dimensions)
            const fpLandmarks = landmarks.map(lm => [
                lm.x * canvasElement.width, 
                lm.y * canvasElement.height, 
                lm.z * canvasElement.width 
            ]);
            
            let bestGesture = null;
            let currentGesture = null;
            let confidencePct = 0;
            
            // Fallback to Fingerpose Math Rules
            const estimated = estimator.estimate(fpLandmarks, 8.0);
            if (estimated.gestures.length > 0) {
                bestGesture = estimated.gestures.reduce((p, c) => (p.score > c.score) ? p : c);
                currentGesture = bestGesture.name;
                confidencePct = Math.min(Math.round(bestGesture.score * 10), 100);
            }
            
            if (bestGesture) {
                
                // Update UI Confidence
                accuracyText.innerText = `${confidencePct}%`;
                accuracyFill.style.width = `${confidencePct}%`;
                accuracyFill.style.background = confidencePct > 85 ? 'var(--success)' : 'var(--primary)';
                
                // Timer Logic
                if (detectingGesture !== currentGesture) {
                    detectingGesture = currentGesture;
                    detectionStartTime = Date.now();
                }
                
                const now = Date.now();
                const heldFor = now - detectionStartTime;
                const progress = Math.min((heldFor / HOLD_TIME_REQUIRED) * 100, 100);
                
                if (progress < 100) {
                    detectedText.innerText = currentGesture;
                    detectedText.style.color = "var(--text)";
                    detectedSubtext.innerText = `Holding... ${Math.round(progress)}%`;
                } else {
                    // Lock in the gesture!
                    if (detectingGesture) {
                        detectedText.innerText = currentGesture;
                        detectedText.style.color = "var(--success)";
                        detectedSubtext.innerText = "Word Appended!";
                        
                        // Append and speak word
                        appendToSentence(currentGesture);
                        speakText(currentGesture);
                        
                        // Reset detection so it doesn't spam append
                        detectingGesture = null;
                        detectionStartTime = Date.now() + 1000; // Wait 1 second before allowing next
                    }
                }
            } else {
                resetDetectionUI();
            }
        } else {
            resetDetectionUI();
        }
        canvasCtx.restore();
    }

    function resetDetectionUI() {
        detectingGesture = null;
        detectionStartTime = 0;
        detectedText.innerText = "-";
        detectedText.style.color = "var(--text)";
        detectedSubtext.innerText = "Show hand gesture";
        accuracyText.innerText = "0%";
        accuracyFill.style.width = "0%";
        accuracyFill.style.background = "var(--primary)";
    }

    // Initialize MediaPipe Hands
    const hands = new Hands({locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }});
    
    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7
    });
    
    hands.onResults(onResults);

    // Initialize MediaPipe FaceMesh
    const faceMesh = new FaceMesh({locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
    }});
    
    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    const faceNmmText = document.getElementById('face-nmm-text');

    faceMesh.onResults((results) => {
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const landmarks = results.multiFaceLandmarks[0];
            
            // Draw minimal, modern face mesh (Lines Removed per request)
            canvasCtx.save();
            
            // Note: We are no longer drawing the lines on the face to keep the UI clean,
            // but the AI is still tracking all 468 points invisibly in the background!
            
            canvasCtx.restore();

            // Simple Heuristic: Check Eyebrows and Mouth
            // Landmarks for FaceMesh:
            // Top lip: 13, Bottom lip: 14
            // Left Eye: 159, Left Eyebrow: 105
            
            const upperLip = landmarks[13];
            const lowerLip = landmarks[14];
            const mouthDistance = Math.abs(upperLip.y - lowerLip.y);
            
            const leftEye = landmarks[159];
            const leftEyebrow = landmarks[105];
            const browDistance = Math.abs(leftEye.y - leftEyebrow.y);

            // Determine NMM State
            let nmmState = "Neutral";
            if (mouthDistance > 0.05) {
                nmmState = "Speaking (Mouth Open)";
            } else if (browDistance > 0.08) {
                nmmState = "Surprised / Yes-No Q";
            } else if (browDistance < 0.04) {
                nmmState = "Wh- Question";
            }

            if (faceNmmText) {
                faceNmmText.innerText = nmmState;
                if (nmmState !== "Neutral") {
                    faceNmmText.style.color = "var(--success)";
                } else {
                    faceNmmText.style.color = "var(--accent-cyan)";
                }
            }
        }
    });

    // Start Camera
    const camera = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({image: videoElement});
            await faceMesh.send({image: videoElement});
        },
        width: 640,
        height: 480
    });
    camera.start();

    // -------------------------------------------------------------
    // 6. Two-Way Communication (Speech-to-Text)
    // -------------------------------------------------------------
    const micBtn = document.getElementById('mic-btn');
    const deafDisplayBoard = document.getElementById('deaf-display-board');
    
    // Check if browser supports SpeechRecognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        
        let isListening = false;
        
        micBtn.addEventListener('click', () => {
            if (isListening) {
                recognition.stop();
                return;
            }
            recognition.start();
        });
        
        recognition.onstart = () => {
            isListening = true;
            micBtn.classList.add('mic-pulsing');
            micBtn.innerHTML = '<ion-icon name="stop-circle-outline"></ion-icon> Stop';
            deafDisplayBoard.innerHTML = '<span class="placeholder-text" style="font-size: 0.95rem;">Listening...</span>';
        };
        
        recognition.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                transcript += event.results[i][0].transcript;
            }
            
            // Auto-scroll logic if text gets too long
            deafDisplayBoard.innerHTML = `<span style="font-weight: 700;">${transcript}</span>`;
            deafDisplayBoard.scrollTop = deafDisplayBoard.scrollHeight;
        };
        
        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            deafDisplayBoard.innerHTML = '<span class="placeholder-text" style="font-size: 0.95rem; color: var(--danger);">Error accessing microphone. Please check permissions.</span>';
        };
        
        recognition.onend = () => {
            isListening = false;
            micBtn.classList.remove('mic-pulsing');
            micBtn.innerHTML = '<ion-icon name="mic-outline"></ion-icon> Speak';
        };
    } else {
        micBtn.disabled = true;
        deafDisplayBoard.innerHTML = '<span class="placeholder-text" style="font-size: 0.95rem; color: var(--warning);">Speech Recognition is not supported in this browser. Please use Chrome.</span>';
    }
});
