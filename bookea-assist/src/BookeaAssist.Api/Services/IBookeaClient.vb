Namespace Services

    ''' <summary>
    ''' Acceso al backend real de Bookea (disponibilidad, turnos, servicios).
    ''' Implementación actual: FakeBookeaClient, con datos simulados de un
    ''' negocio ficticio ("Salón Aurora"), para poder probar el flujo completo
    ''' sin tener aún conectada la base de datos/API real de bookea.lat.
    ''' Cuando esté lista la integración real, se agrega BookeaApiClient
    ''' implementando esta misma interfaz y se cambia el registro en Program.vb
    ''' — el resto del código (el motor de conversación, los controllers) no cambia.
    ''' </summary>
    Public Interface IBookeaClient

        ''' <summary>Lista los servicios que ofrece el negocio, con duración y precio.</summary>
        Function ListarServiciosAsync() As Task(Of List(Of Bookea.Servicio))

        ''' <summary>Horarios disponibles para un servicio en una fecha determinada.</summary>
        Function VerDisponibilidadAsync(servicioId As String, fecha As DateTime) As Task(Of List(Of DateTime))

        ''' <summary>Crea un turno nuevo. Lanza BookeaExcepcion si el horario ya no está disponible.</summary>
        Function CrearTurnoAsync(servicioId As String, fechaHora As DateTime, clienteNombre As String, clienteTelefono As String) As Task(Of Bookea.Turno)

        ''' <summary>Cambia la fecha/hora de un turno existente. Lanza BookeaExcepcion si el turno no existe o el nuevo horario no está disponible.</summary>
        Function ReprogramarTurnoAsync(turnoId As String, nuevaFechaHora As DateTime) As Task(Of Bookea.Turno)

        ''' <summary>Cancela un turno existente. Lanza BookeaExcepcion si el turno no existe.</summary>
        Function CancelarTurnoAsync(turnoId As String) As Task(Of Bookea.Turno)

        ''' <summary>Busca los turnos activos (no cancelados) de un cliente por su número de teléfono.</summary>
        Function ListarTurnosDeClienteAsync(clienteTelefono As String) As Task(Of List(Of Bookea.Turno))

    End Interface

End Namespace
