const express = require('express');
const multer = require('multer');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// 配置图片存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

const ARK_API_KEY = '33e2387e-f6a2-4b3e-90df-9a2e4fe3da0d';
// 优先使用 Endpoint ID，如果 AccessDenied，请确保该 ID 在火山引擎后台已创建且 API Key 有权访问
const MODEL_ID = 'ep-20250801144832-r4n9q'; 

app.post('/api/analyze', upload.single('image'), async (req, res) => {
  let imagePath = '';
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传一张图片' });
    }

    imagePath = req.file.path;
    const imageBase64 = fs.readFileSync(imagePath, { encoding: 'base64' });
    const imageDataUrl = `data:${req.file.mimetype};base64,${imageBase64}`;

    const prompt = `你是一个专业的营养师。请分析图片中的所有食物，识别其种类并估算嘌呤含量（mg/100g）。
请严格按以下JSON格式返回结果，不要包含任何其他文字：
{
  "foods": [
    {
      "name": "食物名称",
      "purine_value": 120,
      "level": "high" | "medium" | "low",
      "bbox": [ymin, xmin, ymax, xmax], 
      "description": "简要介绍及健康提示"
    }
  ]
}
分类标准：高(>150), 中(50-150), 低(<50)。
注意：坐标 bbox 请使用 0-1000 的归一化坐标。仅针对 high 和 medium 级别的食物返回 bbox，low 级别不需要。`;

    const response = await axios.post(
      'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      {
        model: MODEL_ID,
        messages: [
          {
            role: 'user',
            content: [
              { 
                type: 'text', 
                text: "你是一个精准的食物识别助手。请严格识别图片中真实存在的食物。如果图片中没有食物，请返回空列表。请识别每种食物并给出坐标 bbox [ymin, xmin, ymax, xmax]，坐标范围 0-1000。按JSON格式返回: { \"foods\": [...] }" 
              },
              {
                type: 'image_url',
                image_url: { url: imageDataUrl },
              },
            ],
          },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ARK_API_KEY}`,
        },
        timeout: 40000 
      }
    );

    let content = response.data.choices[0].message.content;
    console.log('--- AI Raw Response ---');
    console.log(content); // 打印原始返回，用于调试
    
    content = content.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(content);
    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    res.json(result);

  } catch (error) {
    if (imagePath && fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    console.error('API Error:', error.response?.data || error.message);

    // 如果是权限或配置错误，启动 Mock 模式返回演示数据
    if (error.response?.status === 403 || error.response?.status === 401 || error.message.includes('timeout')) {
      console.log('--- 启动 Mock 演示模式 ---');
      return res.json({
        foods: [
          {
            name: "演示：麻辣小龙虾",
            purine_value: 180,
            level: "high",
            bbox: [200, 200, 500, 500],
            description: "小龙虾属于高嘌呤食物，尤其是虾头和内脏。建议痛风急性期避免食用，缓解期也应严格限量。"
          },
          {
            name: "演示：牛排",
            purine_value: 110,
            level: "medium",
            bbox: [550, 300, 850, 700],
            description: "牛肉属于中嘌呤肉类。建议每日食用量不超过100g，推荐采用水煮或清炖方式减少脂肪摄入。"
          },
          {
            name: "演示：西兰花",
            purine_value: 21,
            level: "low",
            description: "蔬菜类大多属于低嘌呤食物，富含维生素C，有助于尿酸排泄，推荐放心食用。"
          }
        ],
        is_mock: true
      });
    }
    
    res.status(500).json({ error: '服务不可用，请稍后再试' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
