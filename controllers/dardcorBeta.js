const tf = require('@tensorflow/tfjs');
require('@tensorflow/tfjs-backend-cpu');
const use = require('@tensorflow-models/universal-sentence-encoder');
const { knowledgeBase } = require('../utils/knowledge');

let model = null;
let knowledgeTensor = null; 
let responseMap = [];

async function loadAI() {
    await tf.setBackend('cpu');
    await tf.ready();

    if (!model) {
        model = await use.load();
    }

    if (!knowledgeTensor) {
        const allInputs = [];
        responseMap = [];

        knowledgeBase.forEach(item => {
            item.inputs.forEach(inputMsg => {
                allInputs.push(inputMsg);
                responseMap.push(item.output);
            });
        });
        
        const embeddings = await model.embed(allInputs);
        knowledgeTensor = tf.keep(embeddings);
    }

    return model;
}

async function handleBetaChat(message, uploadedFile, historyData) {
    let inputTensor = null;

    try {
        if (!message) return "Saya butuh input teks.";

        await loadAI();

        inputTensor = await model.embed([message.toLowerCase()]);

        const result = tf.tidy(() => {
            const products = tf.matMul(inputTensor, knowledgeTensor, false, true);
            const maxScore = products.max();
            const maxIndex = products.argMax(1);

            return {
                score: maxScore.dataSync()[0],
                index: maxIndex.dataSync()[0]
            };
        });

        if (result.score > 0.45) { 
            return responseMap[result.index];
        } else {
            return "Maaf, saya kurang mengerti. Bisa gunakan kata lain?";
        }

    } catch (error) {
        if (knowledgeTensor) {
            knowledgeTensor.dispose();
            knowledgeTensor = null;
        }
        return "Sistem sedang mengalami gangguan.";
    } finally {
        if (inputTensor) inputTensor.dispose();
    }
}

module.exports = { handleBetaChat };