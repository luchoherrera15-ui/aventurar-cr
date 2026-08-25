Namespace Services

    ''' <summary>
    ''' Implementación simulada de IBookeaClient para el negocio ficticio "Salón Aurora"
    ''' (peluquería/spa de Costa Rica). Se registra como Singleton, así que su estado
    ''' (los turnos creados) vive mientras la app esté corriendo.
    ''' </summary>
    Public Class FakeBookeaClient
        Implements IBookeaClient

        Private Shared ReadOnly _servicios As List(Of Servicio) = New List(Of Servicio) From {
            New Servicio With {.Id = "corte", .Nombre = "Corte de cabello", .DuracionMinutos = 30, .PrecioColones = 8000D},
            New Servicio With {.Id = "manicure", .Nombre = "Manicure", .DuracionMinutos = 45, .PrecioColones = 6000D},
            New Servicio With {.Id = "tinte", .Nombre = "Tinte", .DuracionMinutos = 120, .PrecioColones = 25000D},
            New Servicio With {.Id = "masaje", .Nombre = "Masaje relajante", .DuracionMinutos = 60, .PrecioColones = 18000D}
        }

        Private ReadOnly _turnos As New Dictionary(Of String, Turno)
        Private ReadOnly _bloqueo As New Object()

        Public Function ListarServiciosAsync() As Task(Of List(Of Servicio)) Implements IBookeaClient.ListarServiciosAsync
            Return Task.FromResult(New List(Of Servicio)(_servicios))
        End Function

        Public Function VerDisponibilidadAsync(servicioId As String, fecha As DateTime) As Task(Of List(Of DateTime)) Implements IBookeaClient.VerDisponibilidadAsync
            If Not _servicios.Any(Function(s) s.Id = servicioId) Then
                Throw New BookeaExcepcion("No encontré ese servicio.")
            End If

            Dim horarios As New List(Of DateTime)

            If fecha.DayOfWeek <> DayOfWeek.Sunday Then
                Dim ocupados As HashSet(Of DateTime)

                SyncLock _bloqueo
                    ocupados = New HashSet(Of DateTime)(
                        _turnos.Values.
                            Where(Function(t) t.ServicioId = servicioId AndAlso t.Estado <> "cancelado" AndAlso t.FechaHora.Date = fecha.Date).
                            Select(Function(t) t.FechaHora))
                End SyncLock

                For hora = 9 To 17
                    Dim horario = fecha.Date.AddHours(hora)
                    If Not ocupados.Contains(horario) Then
                        horarios.Add(horario)
                    End If
                Next
            End If

            Return Task.FromResult(horarios)
        End Function

        Public Function CrearTurnoAsync(servicioId As String, fechaHora As DateTime, clienteNombre As String, clienteTelefono As String) As Task(Of Turno) Implements IBookeaClient.CrearTurnoAsync
            Dim servicio = _servicios.FirstOrDefault(Function(s) s.Id = servicioId)
            If servicio Is Nothing Then
                Throw New BookeaExcepcion("No encontré ese servicio.")
            End If

            SyncLock _bloqueo
                Dim yaOcupado = _turnos.Values.Any(Function(t) t.ServicioId = servicioId AndAlso t.FechaHora = fechaHora AndAlso t.Estado <> "cancelado")
                If yaOcupado Then
                    Throw New BookeaExcepcion("Ese horario ya no está disponible.")
                End If

                Dim turno As New Turno With {
                    .Id = Guid.NewGuid().ToString("N").Substring(0, 8),
                    .ServicioId = servicioId,
                    .ServicioNombre = servicio.Nombre,
                    .FechaHora = fechaHora,
                    .ClienteNombre = clienteNombre,
                    .ClienteTelefono = clienteTelefono,
                    .Estado = "confirmado"
                }

                _turnos(turno.Id) = turno
                Return Task.FromResult(turno)
            End SyncLock
        End Function

        Public Function ReprogramarTurnoAsync(turnoId As String, nuevaFechaHora As DateTime) As Task(Of Turno) Implements IBookeaClient.ReprogramarTurnoAsync
            SyncLock _bloqueo
                Dim turno As Turno = Nothing
                If Not _turnos.TryGetValue(turnoId, turno) OrElse turno.Estado = "cancelado" Then
                    Throw New BookeaExcepcion("No encontré ese turno.")
                End If

                turno.FechaHora = nuevaFechaHora
                turno.Estado = "reprogramado"
                Return Task.FromResult(turno)
            End SyncLock
        End Function

        Public Function CancelarTurnoAsync(turnoId As String) As Task(Of Turno) Implements IBookeaClient.CancelarTurnoAsync
            SyncLock _bloqueo
                Dim turno As Turno = Nothing
                If Not _turnos.TryGetValue(turnoId, turno) OrElse turno.Estado = "cancelado" Then
                    Throw New BookeaExcepcion("No encontré ese turno.")
                End If

                turno.Estado = "cancelado"
                Return Task.FromResult(turno)
            End SyncLock
        End Function

        Public Function ListarTurnosDeClienteAsync(clienteTelefono As String) As Task(Of List(Of Turno)) Implements IBookeaClient.ListarTurnosDeClienteAsync
            SyncLock _bloqueo
                Dim resultado = _turnos.Values.
                    Where(Function(t) t.ClienteTelefono = clienteTelefono AndAlso t.Estado <> "cancelado").
                    OrderBy(Function(t) t.FechaHora).
                    ToList()

                Return Task.FromResult(resultado)
            End SyncLock
        End Function

    End Class

End Namespace
