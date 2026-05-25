import json
import os
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

DEFAULT_FLOWS = [
    'authorize_continue',
    'username_password_create',
    'password_verify',
    'oauth_create_account',
    "mfa_totp"
]

OUT = Path(os.environ.get('OUT', './sentinel_multi_helper_out.json'))
PROXY = os.environ.get('PROXY_SERVER', '').strip()
SDK_URL = os.environ.get('SDK_URL', 'https://sentinel.openai.com/sentinel/20260219f9f6/sdk.js').strip()
UA = os.environ.get('UA', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36').strip()
FRAME_URL = os.environ.get('FRAME_URL', 'https://sentinel.openai.com/backend-api/sentinel/frame.html?sv=20260219f9f6').strip()
flows_raw = os.environ.get('FLOWS', '').strip()
FLOWS = [f.strip() for f in flows_raw.split(',') if f.strip()] or DEFAULT_FLOWS

def get_sentinel_tokens(flows=None, proxy=None, user_agent=None, device_id=None):
    """
    使用 Playwright 获取 Sentinel 令牌。
    """
    target_flows = flows or FLOWS
    target_proxy = proxy or PROXY
    target_ua = user_agent or UA
    
    with sync_playwright() as p:

        launch_args = {}
        if target_proxy:
            launch_args['proxy'] = {'server': target_proxy}
        # Docker 环境兼容性增强: 禁用沙箱
        launch_args['args'] = launch_args.get('args', []) + ['--no-sandbox', '--disable-setuid-sandbox']
        
        browser = p.chromium.launch(headless=True, **launch_args)
        context = browser.new_context(
            user_agent=target_ua, 
            locale='en-US', 
            viewport={'width': 1920, 'height': 1080}
        )

        # 如果提供了 device_id，则设置 oai-did Cookie
        if device_id:
            context.add_cookies([{
                'name': 'oai-did',
                'value': device_id,
                'domain': '.openai.com',
                'path': '/',
                'expires': int(time.time()) + 365 * 24 * 3600,
                'httpOnly': True,
                'secure': True,
                'sameSite': 'Lax'
            }])
            
        page = context.new_page()
        
        try:
            print(f"[SentinelBrowser] 正在访问: {FRAME_URL}")
            page.goto(FRAME_URL, wait_until='load', timeout=120000)
            
            # 等待 SDK 加载并执行挑战
            print("[SentinelBrowser] 等待 SentinelSDK 加载 (3s)...")
            page.wait_for_timeout(3000)
            page.wait_for_function('() => !!window.SentinelSDK', timeout=30000)
            
            print(f"[SentinelBrowser] 开始执行流程: {target_flows}")
            result = page.evaluate(
                """async (flows) => {
                    const out = {
                        source: 'playwright_sentinel_multi_helper',
                        generatedAt: new Date().toISOString(),
                        flows: {},
                    };
                    if (!window.SentinelSDK) throw new Error('SentinelSDK missing');
                    for (const flow of flows) {
                        try {
                            await window.SentinelSDK.init(flow);
                            const tok = await window.SentinelSDK.token(flow);
                            let soTok = null;
                            try {
                                soTok = await window.SentinelSDK.sessionObserverToken(flow);
                            } catch (e) {
                                soTok = null;
                            }
                            out.flows[flow] = {
                                flow,
                                token: tok ? JSON.parse(tok) : null,
                                soToken: soTok ? JSON.parse(soTok) : null,
                            };
                        } catch (e) {
                            out.flows[flow] = { error: e.message };
                        }
                    }
                    return out;
                }""",
                target_flows,
            )
            return result
        except Exception as e:
            print(f"[SentinelBrowser] 发生错误: {e}")
            return None
        finally:
            browser.close()

if __name__ == "__main__":
    res = get_sentinel_tokens()
    if res:
        print(json.dumps(res, indent=2))
        OUT.write_text(json.dumps(res, ensure_ascii=False, indent=2), encoding='utf-8')
