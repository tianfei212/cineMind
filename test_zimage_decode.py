import binascii
from io import BytesIO
from PIL import Image

# 日志中的十六进制数据（前86字节）
hex_data = b"86db69b3ffdd6ac86c728a5eadeb2e96d6e3a2cb1c9db7a28e29e06a58b2ba772c7289bfeddfdad7fdb4dbad35d3affcedfd7ae9d7ffd35ebd71b79fe346f8e3deb9f39ef7e75f1c6fd7b56f473cd699e0131a62adeb"

try:
    data = binascii.unhexlify(hex_data)
    print(f"Decoded data length: {len(data)} bytes")
    print(f"First 20 bytes: {data[:20]}")
    
    # 尝试识别图片格式
    img = Image.open(BytesIO(data))
    print(f"Image format: {img.format}")
    print(f"Image size: {img.size}")
except Exception as e:
    print(f"Error: {e}")
