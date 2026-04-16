// 页面配置（已移至 Cloudflare Functions 环境变量）
const NOTION_CONFIG = {
    notionVersion: "2022-06-28"
};

const statusEl = document.getElementById("status");
const navContentEl = document.getElementById("navContent");
const avatarImgEl = document.getElementById("avatarImg");
const refreshBtn = document.getElementById("refreshBtn");

// 处理头像加载失败
if (avatarImgEl) {
    avatarImgEl.addEventListener("error", () => {
        const avatarContainer = avatarImgEl.parentElement;
        avatarContainer.innerHTML = "MF";
        avatarContainer.style.background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
        avatarContainer.style.color = "#fff";
        avatarContainer.style.fontSize = "32px";
        avatarContainer.style.fontWeight = "700";
    });
}

// 页面加载后直接从 Notion 获取数据
window.addEventListener("DOMContentLoaded", fetchNotionData);

// 刷新按钮点击事件
if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
        if (refreshBtn.classList.contains("loading")) return;
        fetchNotionData();
    });
}

async function fetchNotionData() {
    if (refreshBtn) refreshBtn.classList.add("loading");
    
    // Cloudflare Pages 部署建议：使用内置的 Functions 代理
    // 这样可以隐藏 API Key 并解决 CORS 问题
    const apiUrl = "/notion";

    try {
        const response = await fetch(apiUrl, {
            method: "GET", // 改为 GET 以获得更好的兼容性
            headers: {
                "Content-Type": "application/json"
            }
        });

        // 检查响应类型
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            const text = await response.text();
            console.error("服务器返回了非 JSON 响应:", text);
            const preview = text.substring(0, 30).replace(/</g, "&lt;");
            throw new Error(`服务器返回了非 JSON 内容 (HTTP ${response.status}): "${preview}..."。这通常意味着 Cloudflare 没找到你的后端函数，请检查 functions 文件夹是否在根目录并已上传。`);
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `请求失败 (HTTP ${response.status})`);
        }

        const mappedData = mapNotionToObjects(data.results);
        renderNavData(mappedData);
        
        const now = new Date().toLocaleTimeString();
        setStatus(`数据已同步 (最后更新: ${now})`, "status success");
        
        // 3秒后隐藏成功消息
        setTimeout(() => {
            statusEl.style.display = "none";
        }, 3000);
    } catch (error) {
        console.error("数据获取失败:", error);
        
        let errorMsg = error.message;
        if (errorMsg.includes("Failed to fetch")) {
            errorMsg = "网络请求失败，请检查 API 代理是否配置正确。";
        }
        
        setStatus(`同步失败: ${errorMsg}`, "status error");
        
        // 如果同步失败，尝试从 localStorage 加载上次成功的缓存
        const cached = localStorage.getItem('nav_cache');
        const cacheTime = localStorage.getItem('nav_cache_time');
        if (cached) {
            renderNavData(JSON.parse(cached));
            const timeStr = cacheTime ? ` (最后成功同步: ${cacheTime})` : "";
            setStatus(`同步失败，已加载本地缓存数据${timeStr}。错误: ${errorMsg}`, "status error");
        }
    } finally {
        if (refreshBtn) refreshBtn.classList.remove("loading");
    }
}

function setStatus(message, className) {
    statusEl.style.display = "block";
    statusEl.className = className;
    statusEl.textContent = message;
}

// 将 Notion API 返回的复杂 JSON 映射为简单的对象数组
function mapNotionToObjects(results) {
    const items = results.map(page => {
        const props = page.properties;
        const item = {};

        // 映射名称 (Title 类型)
        if (props["名称"] && props["名称"].title) {
            item["名称"] = props["名称"].title.map(t => t.plain_text).join("");
        }

        // 映射分类 (支持 Select, Multi-select, Status, 或 Rich-text 类型)
        if (props["分类"]) {
            const catProp = props["分类"];
            if (catProp.select) {
                item["分类"] = catProp.select.name;
            } else if (catProp.multi_select && catProp.multi_select.length > 0) {
                item["分类"] = catProp.multi_select.map(m => m.name).join(", ");
            } else if (catProp.status) {
                item["分类"] = catProp.status.name;
            } else if (catProp.rich_text && catProp.rich_text.length > 0) {
                item["分类"] = catProp.rich_text.map(r => r.plain_text).join("");
            }
        }

        // 映射链接 (URL 类型)
        if (props["链接"] && props["链接"].url) {
            item["链接"] = props["链接"].url;
        }

        // 映射图标 (Files 或 URL 类型)
        if (props["图标"]) {
            if (props["图标"].url) {
                item["图标"] = props["图标"].url;
            } else if (props["图标"].files && props["图标"].files.length > 0) {
                const file = props["图标"].files[0];
                item["图标"] = file.external ? file.external.url : (file.file ? file.file.url : "");
            }
        }

        return item;
    });

    // 缓存数据
    localStorage.setItem('nav_cache', JSON.stringify(items));
    localStorage.setItem('nav_cache_time', new Date().toLocaleTimeString());
    return items;
}

function renderNavData(data) {
    navContentEl.innerHTML = "";

    if (!data || !data.length) {
        navContentEl.innerHTML = '<div class="empty">数据库为空或未找到匹配字段。</div>';
        return;
    }

    // 使用 Map 来保持分类的原始顺序
    const categoryContainers = new Map();
    let globalIndex = 0; // 用于计算所有卡片的总索引，实现跨分类的交错效果

    data.forEach((item) => {
        const category = item["分类"] || "未分类";
        
        // 如果该分类还没创建过容器，则按顺序创建并添加
        if (!categoryContainers.has(category)) {
            const title = document.createElement("div");
            title.className = "category-title";
            title.textContent = category;
            title.style.animationDelay = `${globalIndex * 0.05}s`;
            navContentEl.appendChild(title);

            const linksContainer = document.createElement("div");
            linksContainer.className = "links-container";
            navContentEl.appendChild(linksContainer);
            
            categoryContainers.set(category, linksContainer);
            globalIndex++;
        }

        const linksContainer = categoryContainers.get(category);

        // 创建链接卡片
        const linkCard = document.createElement("a");
        linkCard.className = "link-card";
        linkCard.href = item["链接"] || "#";
        linkCard.target = "_blank";
        linkCard.rel = "noopener noreferrer";
        linkCard.style.animationDelay = `${globalIndex * 0.05}s`;

        const icon = document.createElement("div");
        icon.className = "link-icon";

        if (item["图标"]) {
            const img = document.createElement("img");
            img.src = item["图标"];
            img.alt = "icon";
            img.addEventListener("error", () => {
                icon.textContent = (item["名称"] || "?").slice(0, 1).toUpperCase();
            });
            icon.appendChild(img);
        } else {
            icon.textContent = (item["名称"] || "?").slice(0, 1).toUpperCase();
        }

        linkCard.innerHTML = `
            ${icon.outerHTML}
            <div class="link-text">
                <div class="link-name">${item["名称"] || "未命名"}</div>
                <svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #9ca3af;"><path d="M9 18l6-6-6-6"></path></svg>
            </div>
        `;
        linksContainer.appendChild(linkCard);
        globalIndex++;
    });
}
