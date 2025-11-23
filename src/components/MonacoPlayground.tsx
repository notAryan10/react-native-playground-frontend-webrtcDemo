'use client';

import React, { useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { Settings } from './SettingsPanel';
import type { editor } from 'monaco-editor';

interface MonacoPlaygroundProps {
  value: string;
  onChange: (value: string) => void;
  settings: Settings;
  language?: string;
}

export const MonacoPlayground: React.FC<MonacoPlaygroundProps> = ({
  value,
  onChange,
  settings,
  language = 'typescript'
}) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      noEmit: true,
      esModuleInterop: true,
      jsx: monaco.languages.typescript.JsxEmit.React,
      allowJs: true,
      typeRoots: ['node_modules/@types'],
    });

    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      noEmit: true,
      esModuleInterop: true,
      jsx: monaco.languages.typescript.JsxEmit.React,
      allowJs: true,
      typeRoots: ['node_modules/@types'],
    });

    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      `
      declare module 'react-native' {
        import { ComponentType, ReactNode } from 'react';
        
        export interface ViewStyle {
          flex?: number;
          flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
          justifyContent?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
          alignItems?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
          padding?: number;
          paddingHorizontal?: number;
          paddingVertical?: number;
          margin?: number;
          marginHorizontal?: number;
          marginVertical?: number;
          backgroundColor?: string;
          borderRadius?: number;
          borderWidth?: number;
          borderColor?: string;
          gap?: number;
          [key: string]: any;
        }
        
        export interface TextStyle extends ViewStyle {
          fontSize?: number;
          fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
          color?: string;
          textAlign?: 'left' | 'center' | 'right' | 'justify';
          lineHeight?: number;
        }
        
        export interface ViewProps {
          style?: ViewStyle | ViewStyle[];
          children?: ReactNode;
          [key: string]: any;
        }
        
        export interface TextProps {
          style?: TextStyle | TextStyle[];
          children?: ReactNode;
          [key: string]: any;
        }
        
        export interface ScrollViewProps extends ViewProps {
          contentContainerStyle?: ViewStyle;
          horizontal?: boolean;
        }
        
        export interface PressableProps extends ViewProps {
          onPress?: () => void;
        }
        
        export const View: ComponentType<ViewProps>;
        export const Text: ComponentType<TextProps>;
        export const ScrollView: ComponentType<ScrollViewProps>;
        export const Pressable: ComponentType<PressableProps>;
        
        export const StyleSheet: {
          create<T>(styles: T): T;
          hairlineWidth: number;
        };
      }
      `,
      'file:///node_modules/@types/react-native/index.d.ts'
    );

    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });
  };

  return (
    <Editor
      height="100%"
      language={language}
      theme={settings.theme === 'dark' ? 'vs-dark' : 'vs-light'}
      value={value}
      onChange={(val) => onChange(val ?? '')}
      onMount={handleEditorDidMount}
      options={{
        fontSize: settings.fontSize,
        minimap: { enabled: settings.minimap },
        lineNumbers: settings.lineNumbers ? 'on' : 'off',
        automaticLayout: true,
        smoothScrolling: true,
        scrollBeyondLastLine: false,
        renderWhitespace: 'none',
        tabSize: 2,
        insertSpaces: true,
      }}
    />
  );
};

export default MonacoPlayground;