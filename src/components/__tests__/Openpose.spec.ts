import { OpenposeObject, OpenposeKeypoint2D, OpenposeConnection } from '../../Openpose';
import { fabric } from 'fabric';
import {describe, it, expect} from 'vitest'

describe('OpenposeObject', () => {
  it.each([
    new OpenposeKeypoint2D(-1, 1, 1.0, 'rgb(0, 0, 0)', 'name'),
    new OpenposeKeypoint2D(1, 1, 0.0, 'rgb(0, 0, 0)', 'name'),
    new OpenposeKeypoint2D(1, -1, 1.0, 'rgb(0, 0, 0)', 'name'),
  ])('Should set invalid keypoints invisible', (invalid_keypoint: OpenposeKeypoint2D) => {
    const object = new OpenposeObject([invalid_keypoint], []);
    expect(object.keypoints[0].visible).toBeFalsy();
  });

  it.each([
    new OpenposeKeypoint2D(1, 1, 1.0, 'rgb(0, 0, 0)', 'name'),
    new OpenposeKeypoint2D(100, 1, 1.0, 'rgb(0, 0, 0)', 'name'),
  ])('Should set valid keypoints visible', (valid_keypoint: OpenposeKeypoint2D) => {
    const object = new OpenposeObject([valid_keypoint], []);
    expect(object.keypoints[0].visible).toBeTruthy();
  });
});