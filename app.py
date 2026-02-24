from flask import Flask, render_template, jsonify, request
import random

app = Flask(__name__)

# Advanced Game State
game_state = {
    "current_level": 1,
    "current_student_idx": 0,
    "students": ["Alex", "Blake", "Casey", "Drew", "Emery"],
    "health": 100,
    "water_level": 0,
    "time_remaining": 60,
    "is_active": False,
    "game_over": False,
    "won": False,
    "inventory": [],
    "level_config": {
        1: {"objective": "Find the hidden key!", "time": 60, "objects": ["Desk 1", "Desk 2", "Desk 3", "Desk 4", "Desk 5", "Desk 6", "Desk 7", "Desk 8", "Desk 9", "Desk 10", "Bookshelf"], "key_loc": "Desk 5"},
        2: {"objective": "Avoid dangerous water zones!", "time": 90, "hazards": True},
        3: {"objective": "Help weak students escape!", "time": 120, "students_to_save": 3},
        4: {"objective": "Find the hidden drain!", "time": 100, "drain_hidden_under": "Bookshelf"},
        5: {"objective": "Final Escape! Use everything you learned!", "time": 150}
    },
    "npc_status": {
        "Alex": {"state": "sitting", "is_weak": False, "saved": False},
        "Blake": {"state": "standing", "is_weak": True, "saved": False},
        "Casey": {"state": "sitting", "is_weak": False, "saved": False},
        "Drew": {"state": "standing", "is_weak": True, "saved": False},
        "Emery": {"state": "sitting", "is_weak": False, "saved": False}
    }
}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/start_level', methods=['POST'])
def start_level():
    global game_state
    data = request.json
    level = data.get("level", game_state["current_level"])
    
    config = game_state["level_config"].get(level, game_state["level_config"][1])
    
    game_state["current_level"] = level
    game_state["water_level"] = 0
    game_state["health"] = 100
    game_state["time_remaining"] = config["time"]
    game_state["is_active"] = True
    game_state["game_over"] = False
    game_state["won"] = False
    game_state["inventory"] = []
    
    # Randomize key for Level 1 if needed
    if level == 1:
        # Restore students if list is empty (game over)
        if not game_state["students"]:
            game_state["students"] = ["Alex", "Blake", "Casey", "Drew", "Emery"]
            game_state["current_student_idx"] = 0
        
    return jsonify({"status": "started", "config": config})

@app.route('/update_state', methods=['POST'])
def update_state():
    global game_state
    data = request.json
    # Update state from client actions
    if "water_increment" in data:
        game_state["water_level"] = min(100, game_state["water_level"] + data["water_increment"])
    if "health_change" in data:
        game_state["health"] = max(0, min(100, game_state["health"] + data["health_change"]))
    if "time_tick" in data:
        game_state["time_remaining"] -= 1
        
    if game_state["water_level"] >= 100 or game_state["health"] <= 0 or game_state["time_remaining"] <= 0:
        game_state["game_over"] = True
        game_state["is_active"] = False
        
    return jsonify(game_state)

@app.route('/interact', methods=['POST'])
def interact():
    global game_state
    data = request.json
    action = data.get("action")
    target = data.get("target")
    
    level = game_state["current_level"]
    config = game_state["level_config"][level]
    
    result = {"status": "ok", "message": ""}
    
    if action == "pickup":
        if level == 1:
            if target == config["key_loc"]:
                if "Key" not in game_state["inventory"]:
                    game_state["inventory"].append("Key")
                    result["message"] = f"YOU WIN! {game_state['students'][game_state['current_student_idx']]} found the key! Now go to the Door to Escape!"
                else:
                    result["message"] = "You already have the key! Go to the Door!"
            elif target == "ClassroomDoor":
                if "Key" in game_state["inventory"]:
                    game_state["won"] = True
                    result["message"] = "DOOR OPENED! RUN OUT!"
                    result["escape"] = True
                else:
                    result["message"] = "The door is locked! Find the key first!"
            else:
                result["message"] = "Nothing here... Keep searching!"
        
        elif level == 2 or level == 3 or level == 4:
            if target == "ClassroomDoor":
                 # In level 2, 3, 4 we can just escape if objective met? 
                 # Let's check objectives
                 can_escape = True
                 if level == 3:
                     saved_count = sum(1 for s in game_state["npc_status"].values() if s["saved"])
                     if saved_count < config["students_to_save"]:
                         can_escape = False
                         result["message"] = f"You need to save {config['students_to_save'] - saved_count} more students!"
                 
                 if can_escape:
                    game_state["won"] = True
                    result["message"] = "DOOR OPENED! ESCAPE!"
                    result["escape"] = True
            elif target == "Bookshelf" and level == 4:
                result["message"] = "You found a hidden Drain under the bookshelf! Use it to lower the water!"
                result["reveal_drain"] = True
            else:
                result["message"] = "Nothing here... Keep searching!"

        elif level == 5:
            if target == "Key":
                game_state["inventory"].append("Key")
                result["message"] = "Picked up the final key!"
            elif target == "ClassroomDoor":
                 if "Key" in game_state["inventory"]:
                    game_state["won"] = True
                    result["message"] = "FREEDOM! YOU ESCAPED!"
                    result["escape"] = True
    elif action == "use_drain":
        if level == 4 and target == "Drain":
            game_state["water_level"] = max(0, game_state["water_level"] - 30)
            result["message"] = "Water is draining!"
            
    elif action == "save_student":
        if target in game_state["npc_status"]:
            game_state["npc_status"][target]["saved"] = True
            result["message"] = f"You helped {target} escape!"

    return jsonify({"game_state": game_state, "result": result})

@app.route('/get_hint', methods=['GET'])
def get_hint():
    global game_state
    # Check if current student is allowed to use hint (last 3 students)
    # Total 10 students, indices 0-9. Last 3 are 7, 8, 9
    if game_state["current_student_idx"] < 7:
        return jsonify({"error": "Only the last 3 students can use hints!"}), 403
        
    level = game_state["current_level"]
    config = game_state["level_config"].get(level)
    
    hint = "No hint available for this level."
    if level == 1:
        hint = f"I think I saw something near {config['key_loc']}..."
    elif level == 4:
        hint = f"Look under the {config['drain_hidden_under']}!"
        
    return jsonify({"hint": hint})

@app.route('/next_turn', methods=['POST'])
def next_turn():
    global game_state
    # Remove the student who just failed
    if game_state["students"]:
        failed_student_idx = game_state["current_student_idx"]
        game_state["students"].pop(failed_student_idx)
        
        # Adjust index if we removed the last student or if index is now out of bounds
        if not game_state["students"]:
            game_state["game_over"] = True
        elif game_state["current_student_idx"] >= len(game_state["students"]):
            game_state["current_student_idx"] = 0
            
    return jsonify({"game_state": game_state})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
