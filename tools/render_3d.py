"""Static CAD render for the README; no browser or desktop automation required."""
import json
from pathlib import Path
import vtkmodules.all as vtk
R=Path(__file__).resolve().parents[1]
data=json.loads((R/'hardware/3d/model-data.json').read_text(encoding='utf-8'))
ren=vtk.vtkRenderer(); ren.SetBackground(.075,.11,.145); ren.SetBackground2(.19,.26,.31);ren.GradientBackgroundOn()
for p in data['parts']:
    if p['kind']=='keepout' or p['group']=='Cover':continue
    points=vtk.vtkPoints();cells=vtk.vtkCellArray()
    for v in p['vertices']:points.InsertNextPoint(*v)
    for t in p['faces']:
        cells.InsertNextCell(3)
        for i in t:cells.InsertCellPoint(i)
    poly=vtk.vtkPolyData();poly.SetPoints(points);poly.SetPolys(cells)
    normals=vtk.vtkPolyDataNormals();normals.SetInputData(poly);normals.SetFeatureAngle(45);normals.SplittingOn()
    mapper=vtk.vtkPolyDataMapper();mapper.SetInputConnection(normals.GetOutputPort())
    actor=vtk.vtkActor();actor.SetMapper(mapper);prop=actor.GetProperty();col=p['color'];prop.SetColor(*[int(col[i:i+2],16)/255 for i in (1,3,5)]);prop.SetSpecular(.25);prop.SetSpecularPower(30)
    if p['group']=='Case':prop.SetOpacity(.2)
    ren.AddActor(actor)
win=vtk.vtkRenderWindow();win.SetOffScreenRendering(1);win.SetSize(1400,1000);win.AddRenderer(ren);win.SetMultiSamples(4)
cam=ren.GetActiveCamera();cam.SetViewUp(0,0,1);cam.SetPosition(290,340,270);cam.SetFocalPoint(80,80,23);cam.SetViewAngle(35);ren.ResetCameraClippingRange()
title=vtk.vtkTextActor();title.SetInput('LIGHTNING DETECTOR  /  V1');title.SetPosition(40,945);title.GetTextProperty().SetFontSize(24);title.GetTextProperty().SetColor(.86,.94,.96);ren.AddActor2D(title)
subtitle=vtk.vtkTextActor();subtitle.SetInput('Hammond manufacturer case geometry | CAD-derived PCB outlines | representative fitted parts');subtitle.SetPosition(40,910);subtitle.GetTextProperty().SetFontSize(17);subtitle.GetTextProperty().SetColor(.62,.77,.81);ren.AddActor2D(subtitle)
note=vtk.vtkTextActor();note.SetInput('160 x 160 x 60.5 mm case\nFull interactive model: hardware/3d/viewer.html\nTransparent base; cover hidden for inspection');note.SetPosition(40,45);note.GetTextProperty().SetFontSize(18);note.GetTextProperty().SetColor(.68,.81,.85);ren.AddActor2D(note)
win.Render();capture=vtk.vtkWindowToImageFilter();capture.SetInput(win);capture.Update();png=vtk.vtkPNGWriter();png.SetFileName(str(R/'hardware/3d/assembly-preview.png'));png.SetInputConnection(capture.GetOutputPort());png.Write();win.Finalize();print('Wrote assembly-preview.png')
