import React, { FC, useEffect, useRef } from 'react';
import { useWindowSize } from 'react-use';
import { ReactComponent as Circle } from './circle.svg';
import { setupGlobe, destroyGlobe } from './animate';
import fallback from './fallback.png';
import styles from './styles.less';

interface Props {
  height: string;
}

export const Globe: FC<Props> = (props) => {
  const { height } = props;

  const globe = useRef();
  const circle = useRef();
  const canvas = useRef();

  const ws = useWindowSize();
  const aspectOK = ws.width / ws.height > 1.5;

  if (circle.current) {
    aspectOK ? circle.current.classList.add(styles.active) : circle.current.classList.remove(styles.active);
  }

  useEffect(() => () => destroyGlobe(), []);

  useEffect(() => {
    const ready = globe.current && canvas.current && circle.current;
    ready &&
      setupGlobe(globe.current, canvas.current, () => {
        aspectOK && circle.current.classList.add(styles.active);
      });
  }, [globe, canvas, circle]);

  return (
    <div className={styles.container} style={{ height }}>
      <div ref={globe} className={styles.globe}>
        {window.WebGLRenderingContext ? (
          <>
            <div ref={circle} className={styles.halo}>
              <Circle />
            </div>
            <canvas ref={canvas} className={styles.canvas} />
          </>
        ) : (
          <img style={{ height: '100%' }} src={fallback} alt="" />
        )}
      </div>
    </div>
  );
};
