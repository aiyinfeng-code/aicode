const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');
const uploadSection = document.getElementById('upload-section');
const resultSection = document.getElementById('result-section');
const loading = document.getElementById('loading');
const resultImage = document.getElementById('result-image');
const overlay = document.getElementById('overlay');

// 处理点击和拖拽
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-blue-500');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('border-blue-500'));
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-blue-500');
    if (e.dataTransfer.files.length) {
        handleUpload(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        handleUpload(e.target.files[0]);
    }
});

async function handleUpload(file) {
    if (!file.type.startsWith('image/')) {
        alert('请上传图片文件');
        return;
    }

    // 预览图片
    const reader = new FileReader();
    reader.onload = (e) => {
        resultImage.src = e.target.result;
    };
    reader.readAsDataURL(file);

    // 显示加载状态
    uploadSection.classList.add('hidden');
    loading.classList.remove('hidden');
    resultSection.classList.add('hidden');
    overlay.innerHTML = '';

    const formData = new FormData();
    formData.append('image', file);

    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        displayResults(data.foods);
    } catch (error) {
        alert(error.message || '识别失败，请重试');
        uploadSection.classList.remove('hidden');
    } finally {
        loading.classList.add('hidden');
    }
}

function displayResults(foods) {
    resultSection.classList.remove('hidden');
    
    // 清空旧数据
    ['high', 'medium', 'low'].forEach(level => {
        const container = document.getElementById(`${level}-risk`);
        const list = container.querySelector('.list-container');
        list.innerHTML = '';
        container.classList.add('hidden');
    });

    foods.forEach((food, index) => {
        // 添加到列表
        const container = document.getElementById(`${food.level}-risk`);
        container.classList.remove('hidden');
        const list = container.querySelector('.list-container');
        
        const card = document.createElement('div');
        card.className = 'bg-white p-4 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition';
        card.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <span class="font-bold text-gray-800">${food.name}</span>
                <span class="text-sm font-medium px-2 py-1 rounded ${getBadgeColor(food.level)}">
                    ${food.purine_value} mg/100g
                </span>
            </div>
            <p class="text-sm text-gray-600 leading-relaxed">${food.description}</p>
        `;
        list.appendChild(card);

        // 绘制 BBox
        if (food.bbox && food.bbox.length === 4) {
            drawBBox(food.bbox, food.level, food.name);
        }
    });
}

function getBadgeColor(level) {
    switch(level) {
        case 'high': return 'bg-red-100 text-red-700';
        case 'medium': return 'bg-orange-100 text-orange-700';
        case 'low': return 'bg-green-100 text-green-700';
        default: return 'bg-gray-100 text-gray-700';
    }
}

function drawBBox(bbox, level, name) {
    const [ymin, xmin, ymax, xmax] = bbox;
    
    const box = document.createElement('div');
    box.className = `absolute pointer-events-auto cursor-help bbox-${level} transition-all duration-300`;
    
    // 归一化坐标转换为百分比
    box.style.top = `${ymin / 10}%`;
    box.style.left = `${xmin / 10}%`;
    box.style.width = `${(xmax - xmin) / 10}%`;
    box.style.height = `${(ymax - ymin) / 10}%`;
    
    // 悬停显示名称
    box.title = `${name}`;
    
    overlay.appendChild(box);
}
