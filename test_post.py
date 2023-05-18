import requests

print(requests.post('http://localhost:7860/openpose_editor_index/', json={"image": 'AAA', 'pose': 'pose'}).text)