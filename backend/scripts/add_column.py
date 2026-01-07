import sqlite3

def add_column():
    conn = sqlite3.connect('backend/cinemind.db')
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE graph_results ADD COLUMN user_selection TEXT")
        conn.commit()
        print("Column added successfully")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    add_column()