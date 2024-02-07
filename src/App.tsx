import { useEffect, useState } from 'react';
import { useInterval } from './hooks/useInterval';
import { invoke } from '@tauri-apps/api';
import LevellingGuide from './components/levelling-guide';
import Navbar from './components/navbar';
import { useGuideStore } from './store/guide.store';
import { Switch } from 'ktools-r';
import { AppScanningState, AppState, useAppStore } from './store/app.store';
import {
  LogicalPosition,
  LogicalSize,
  appWindow,
  availableMonitors
} from '@tauri-apps/api/window';
import { Button } from './components/ui/button';
import {
  getLocalStorage,
  saveLocalStorage
} from './utilities/save-localstorage';
import {
  isRegistered,
  register,
  unregister
} from '@tauri-apps/api/globalShortcut';
import { ISubstep } from './interfaces/guide.interface';
import useMachine, { IState } from './hooks/useMachine';

const appStates: IState[] = [
  {
    name: 'normal',
    on: {
      enter: async () => {
        const monitors = await availableMonitors();
        const monitorSize = monitors[0].size;

        appWindow.setPosition(
          new LogicalPosition(
            monitorSize.width / 2 - 400,
            monitorSize.height / 2 - 300
          )
        );

        appWindow.setSize(new LogicalSize(800, 600));
        appWindow.setAlwaysOnTop(false);
        appWindow.setIgnoreCursorEvents(false);

        useAppStore.setState({
          appScanningState: AppScanningState.NOT_SCANNING
        });
      },
      leave: () => {}
    }
  },
  {
    name: 'in-game',
    on: {
      enter: () => {
        const { x: displayPositionX, y: displayPositionY } = JSON.parse(
          getLocalStorage('display-position') || '{"x": 0, "y": 0}'
        );

        appWindow.setPosition(
          new LogicalPosition(displayPositionX, displayPositionY)
        );
        appWindow.setSize(new LogicalSize(480, 120));
        appWindow.setAlwaysOnTop(true);
        appWindow.setIgnoreCursorEvents(true);
        document.body.classList.add('bg-background/70');

        useAppStore.setState({
          appScanningState: AppScanningState.SCANNING
        });
      },
      leave: () => {
        document.body.classList.remove('bg-background/70');
      }
    }
  },
  {
    name: 'test',
    on: {
      enter: () => {
        const { x: displayPositionX, y: displayPositionY } = JSON.parse(
          getLocalStorage('display-position') || '{"x": 0, "y": 0}'
        );

        appWindow.setPosition(
          new LogicalPosition(displayPositionX, displayPositionY)
        );

        appWindow.setSize(new LogicalSize(480, 120));
        appWindow.setAlwaysOnTop(true);
        appWindow.setIgnoreCursorEvents(false);
        document.body.classList.add('bg-background/70');
        document.body.classList.add('border-2');
        document.body.classList.add('border-primary');
        document.body.classList.add('border-dashed');
      },
      leave: () => {
        document.body.classList.remove('bg-background/70');
        document.body.classList.remove('border-2');
        document.body.classList.remove('border-primary');
        document.body.classList.remove('border-dashed');
      }
    }
  }
];

function App() {
  const [areaName, setAreaName] = useState<string>();
  const { transition } = useMachine(appStates, 'normal');

  const {
    guide,
    currentStep,
    setCurrentStep,
    setAddCurrentStep,
    setSubtractCurrentStep
  } = useGuideStore((state) => state);
  const { setAppState, appScanningState } = useAppStore((state) => state);
  const appState = useAppStore((state) => state.appState);

  const CLIENT_PATH =
    'C:\\Program Files (x86)\\Grinding Gear Games\\Path of Exile\\logs\\Client.txt';

  useInterval(async () => {
    if (appScanningState === AppScanningState.NOT_SCANNING) return;

    try {
      const response: any = await invoke('get_area_name', {
        fileLocation: CLIENT_PATH
      });
      setAreaName(response);
    } catch (e: any) {
      setAreaName('');
    }
  }, 1000);

  useEffect(() => {
    // Binding
    isRegistered('CmdOrCtrl+Shift+Alt+F12').then((isRegistered) => {
      if (!isRegistered) {
        register('CmdOrCtrl+Shift+Alt+F12', () => {
          setAppState(AppState.NORMAL);
        });
      }
    });

    isRegistered('CmdOrCtrl+Shift+Alt+PageUp').then((isRegistered) => {
      if (!isRegistered) {
        register('CmdOrCtrl+Shift+Alt+PageUp', () => {
          if (currentStep === null) return;
          setAddCurrentStep();
        });
      }
    });

    isRegistered('CmdOrCtrl+Shift+Alt+PageDown').then((isRegistered) => {
      if (!isRegistered) {
        // TODO: Change to arrows
        register('CmdOrCtrl+Shift+Alt+PageDown', () => {
          if (currentStep === null) return;
          setSubtractCurrentStep();
        });
      }
    });

    return () => {
      unregister('CmdOrCtrl+Shift+Alt+F12');
      unregister('CmdOrCtrl+Shift+Alt+PageUp');
      unregister('CmdOrCtrl+Shift+Alt+PageDown');
    };
  }, []);

  useEffect(() => {
    if (guide === null || currentStep === null) return;

    // if (appState === AppState.IN_GAME) {
    if (areaName === guide[currentStep].changeAreaId) {
      setCurrentStep(currentStep + 1);
    }
    // }
  }, [areaName]);

  useEffect(() => {
    switch (appState) {
      case AppState.NORMAL:
        transition('normal');
        break;
      case AppState.IN_GAME:
        transition('in-game');
        break;
      case AppState.TEST:
        transition('test');
        break;
    }
  }, [appState]);

  const handleOnSetPlace = async () => {
    const { x, y } = await appWindow.innerPosition();

    saveLocalStorage('display-position', JSON.stringify({ x, y }));

    setAppState(AppState.NORMAL);
  };

  const handleOnSetPlaceCancel = async () => {
    setAppState(AppState.NORMAL);
  };

  return (
    <Switch>
      <Switch.Case condition={appState === AppState.TEST}>
        <section
          data-tauri-drag-region
          className='w-full h-full text-center flex flex-col gap-2 justify-center items-center cursor-move'
        >
          <p className='select-none' data-tauri-drag-region>
            Drag to set Positon
          </p>
          <div className='flex flex-row gap-2'>
            <Button size='sm' onClick={handleOnSetPlace}>
              Set Place
            </Button>
            <Button
              size='sm'
              variant='destructive'
              onClick={handleOnSetPlaceCancel}
            >
              Cancel
            </Button>
          </div>
        </section>
      </Switch.Case>
      <Switch.Case condition={appState === AppState.IN_GAME}>
        <section className='w-full h-full text-center flex flex-row gap-2 justify-around items-center select-none'>
          <div className='flex flex-col gap-1'>
            {guide && currentStep !== null && (
              <>
                {guide[currentStep].subSteps.map(
                  (subStep: ISubstep, index: number) => (
                    <div key={index}>
                      <p>{subStep.description}</p>
                    </div>
                  )
                )}
              </>
            )}
          </div>
        </section>
      </Switch.Case>
      <Switch.Default>
        <Navbar />
        <main className='flex-grow p-2 overflow-y-auto'>
          <Switch>
            <Switch.Case condition={!!guide}>
              <LevellingGuide levellingGuide={guide!} />
            </Switch.Case>
            <Switch.Default>
              <div className='flex-grow p-2'>
                <h2>No guide selected</h2>
              </div>
            </Switch.Default>
          </Switch>
        </main>
      </Switch.Default>
    </Switch>
  );
}

export default App;
