""" 
Used to process keypoints generated from ControlNet extension.
"""
import json
from typing import List, Tuple

def process_keypoints(nums: List[float], width: int, height: int) -> List[List[float]]:
    if not nums:
        return []
    
    assert len(nums) % 3 == 0
    
    def find_min(nums: float):
        return min(num for num in nums if num > 0)

    base_x = find_min(nums[::3])
    base_y = find_min(nums[1::3])

    return [
        [(x-base_x) * width, (y-base_y) * height, c]
        for x, y, c in zip(nums[::3], nums[1::3], nums[2::3])
    ]



if __name__ == '__main__':
    with open('pose.json', 'r') as f:
        pose = json.load(f)
        person = pose["people"][0]
        
    with open('output_pose.json', 'w') as f:
        width = pose['canvas_width']
        height = pose['canvas_height']

        json.dump({
            'left_hand': process_keypoints(person['hand_left_keypoints_2d'], width, height),
            'right_hand': process_keypoints(person['hand_right_keypoints_2d'], width, height),
            'face': process_keypoints(person['face_keypoints_2d'], width, height),
        }, f, indent=4)
