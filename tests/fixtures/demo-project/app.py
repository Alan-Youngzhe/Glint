def greet(name):
    return f"hello {name}"


# handler 调 greet（Python 解析 + 调用边）
def handler(event):
    return greet(event)
