import React, { useCallback, useEffect } from 'react';
import { Editor, Frame, Element } from '@craftjs/core';
import { usePageBuilder } from '@src/contexts/PageBuilderContext';
import { Container } from './blocks/Container';
import { Text } from './blocks/Text';
import { Heading } from './blocks/Heading';
import { Image } from './blocks/Image';
import { Button } from './blocks/Button';
import { Hero } from './blocks/Hero';

interface PageBuilderCanvasProps {
  children?: React.ReactNode;
}

export function PageBuilderCanvas({ children }: PageBuilderCanvasProps) {
  const { blocks, setBlocks } = usePageBuilder();

  const resolver = {
    Container,
    Text,
    Heading,
    Image,
    Button,
    Hero
  };

  const handleNodesChange = useCallback((query: any) => {
    const serialized = query.serialize();
    setBlocks(serialized);
  }, [setBlocks]);

  return (
    <div className="flex-1 overflow-auto bg-slate-100">
      <Editor
        resolver={resolver}
        onNodesChange={handleNodesChange}
        onRender={({ render }) => <Frame>{render}</Frame>}
      >
        <div className="min-h-screen p-8">
          <Element is={Container} canvas id="ROOT">
            {children}
          </Element>
        </div>
      </Editor>
    </div>
  );
}

